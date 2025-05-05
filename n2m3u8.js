import https from 'https';
import http from 'http';
import { writeFileSync, readFileSync } from 'fs';

/**
 * Check if a segment is available on a server using HTTP HEAD request
 * 
 * @param {string} serverUrl - Base URL of the server
 * @param {string} segment - Segment filename
 * @returns {Promise<boolean>} - True if segment is available (200 response), false otherwise
 */
async function checkSegmentAvailability(serverUrl, segment) {
  return new Promise((resolve) => {
    const url = new URL(segment, serverUrl);
    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.request(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.end();
  });
}

/**
 * Find the first server that has the segment available
 * 
 * @param {Array<string>} servers - List of server URLs
 * @param {string} segment - Segment filename
 * @returns {Promise<string|null>} - URL of the server with the segment, or null if not found
 */
async function findServerForSegment(servers, segment) {
  for (const server of servers) {
    const isAvailable = await checkSegmentAvailability(server, segment);
    if (isAvailable) {
      return server;
    }
  }
  return null;
}

/**
 * Generate an m3u8 playlist from video segments distributed across multiple servers
 * 
 * @param {Object} config - Configuration object
 * @param {Array<string>} config.servers - List of server URLs
 * @param {Array<string>} config.segments - Ordered list of segment filenames
 * @param {string} config.encryptionKey - Base64 encoded encryption key
 */
async function generateM3U8Playlist(config) {
  const {
    servers,
    segments,
    encryptionKey
  } = config;

  // Create the encryption key file
  writeFileSync('/tmp/enc.key', Buffer.from(encryptionKey, 'base64'));

  // Start building the m3u8 content
  let m3u8Content = '#EXTM3U\n';
  m3u8Content += '#EXT-X-VERSION:3\n';
  m3u8Content += '#EXT-X-TARGETDURATION:6\n'; // 6 second segments
  m3u8Content += '#EXT-X-MEDIA-SEQUENCE:0\n';
  m3u8Content += '#EXT-X-KEY:METHOD=AES-128,URI="file:///tmp/enc.key",IV=0x00000000000000000000000000000000\n';

  // Process each segment in the ordered list
  for (let i = 0; i < segments.length; i++) {
    const segment = `${segments[i]}.ts`;
    const serverUrl = await findServerForSegment(servers, segment);

    if (!serverUrl) {
      throw new Error(`No server found for segment: ${segment}`);
    }

    // Calculate actual segment duration
    let segmentDuration = 6.0;

    // Add segment information to the playlist
    m3u8Content += `#EXTINF:${segmentDuration.toFixed(1)},\n`;
    m3u8Content += `${serverUrl}/${segment}\n`;
  }

  // Add the end marker
  m3u8Content += '#EXT-X-ENDLIST\n';

  // Output to stdout
  process.stdout.write(m3u8Content);
  process.exit(0);
}

// Read data from stdin (piped input)
let inputData = '';

// Set up stdin to receive data
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

// Process the data when stdin ends
process.stdin.on('end', async () => {
  let config;

  try {
    const eventData = JSON.parse(inputData);

    // Validate it's a nostr event of kind 1663
    if (!eventData.kind || eventData.kind !== 1663) {
      throw new Error('Input must be a nostr event of kind 1663');
    }

    // Extract data from tags
    const urlTags = eventData.tags.filter(tag => tag[0] === 'url');
    const segmentTags = eventData.tags.filter(tag => tag[0] === 'x');
    const keyTag = eventData.tags.find(tag => tag[0] === 'aes_key');

    // Convert to the format our generator expects
    config = {
      servers: urlTags.map(tag => tag[1]),
      segments: segmentTags.map(tag => tag[1]),
      encryptionKey: keyTag ? keyTag[1] : null
    };

    // Validate required fields
    if (!config.servers || config.servers.length === 0) {
      throw new Error('Event must include at least one "url" tag');
    }
    if (!config.segments || config.segments.length === 0) {
      throw new Error('Event must include at least one "x" tag for segments');
    }
    if (!config.encryptionKey) {
      throw new Error('Event must include a "key" tag');
    }

    // Generate the playlist
    await generateM3U8Playlist(config);

  } catch (error) {
    console.error(`Error processing input: ${error.message}`);
    process.exit(1);
  }
});

// Show usage if stdin is a TTY (interactive terminal)
if (process.stdin.isTTY) {
  console.error('Usage: cat nostr-event.json | node n2m3u8.js');
  console.error('Or:    another-command | node n2m3u8.js');
  process.exit(1);
}