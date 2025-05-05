// Node ≥ 18  (ESM)
//
// Convert a video file into an AES-128–encrypted HLS package
//
// Usage:  node generate.js input.mp4 outputDir
//
// Directory layout:
//
// outputDir
// ├─ index.m3u8
// ├─ [segment hashes].ts    ← SHA-256 hashed segment files
//
// Prerequisite: ffmpeg ≥ 4.1 in $PATH
//-----------------------------------------------------------

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, readFile, rename, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

if (process.argv.length < 4) {
  console.error('Usage: node generate.js inputFile outputDir');
  process.exit(1);
}

const inputFile = resolve(process.argv[2]);
const outputDir = resolve(process.argv[3]);

//-----------------------------------------------------------
// Helpers
//-----------------------------------------------------------
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
  });
}

//-----------------------------------------------------------
// Prepare AES key and key-info helper file for ffmpeg
//-----------------------------------------------------------
async function prepareKeyFiles(dir) {
  const keyInfoFile = join(dir, 'enc.keyinfo');
  const tempKeyFile = join(dir, 'enc.key.temp');

  // 16 random bytes → lightest/fastest encryption = AES-128-CBC
  const key = randomBytes(16);
  // Write key to temporary file for ffmpeg, will be deleted later
  await writeFile(tempKeyFile, key);

  // keyinfo format:
  // 1) URI seen by the player        (relative path is fine)
  // 2) local file path for ffmpeg    (absolute path safest)
  // 3) optional IV (leave empty ⇒ IV derived from segment number)
  const keyInfo = `enc.key\n${tempKeyFile}\n`;
  await writeFile(keyInfoFile, keyInfo);

  return { keyInfoFile, key, tempKeyFile };
}

//-----------------------------------------------------------
// Main
//-----------------------------------------------------------
(async () => {
  // fresh output dir
  await rm(outputDir, { recursive: true, force: true }).catch(() => { });
  await mkdir(outputDir, { recursive: true });

  const { keyInfoFile, key, tempKeyFile } = await prepareKeyFiles(outputDir);

  // build only one rendition
  await buildHLS(keyInfoFile);

  // Hash and rename segments
  const segmentMap = await hashAndRenameSegments(outputDir);

  // Update the m3u8 file with the new segment names
  await updateM3u8WithHashes(outputDir, segmentMap);

  // Generate Nostr event
  const nostrEvent = generateNostrEvent(key, segmentMap);

  // Remove temporary key file
  await rm(tempKeyFile).catch(() => { });
  await rm(keyInfoFile).catch(() => { });

  console.log(JSON.stringify(nostrEvent, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});

//-----------------------------------------------------------
// Build HLS playlist and segments
//-----------------------------------------------------------
async function buildHLS(keyInfo) {
  const args = [
    '-y',
    '-i', inputFile,

    // video - 480p resolution with increased compression
    '-c:v', 'h264', '-profile:v', 'main',
    '-vf', 'scale=-2:480', // Scale to 480p with width divisible by 2
    '-crf', '26', // Higher CRF value = more compression (range 0-51)
    '-g', '48', '-keyint_min', '48',

    // audio
    '-c:a', 'aac', '-ar', '48000', '-b:a', '128k',

    // HLS options
    '-hls_time', '6',
    '-hls_segment_filename', join(outputDir, 'segment_%03d'),
    '-hls_playlist_type', 'vod',

    // AES-128 encryption
    '-hls_key_info_file', keyInfo,

    // output playlist
    join(outputDir, 'index.m3u8'),
  ];

  console.log(`\n→ Encoding video (encrypted) ...`);
  await run('ffmpeg', args);
}

//-----------------------------------------------------------
// Hash and rename segment files
//-----------------------------------------------------------
async function hashAndRenameSegments(dir) {
  const segmentMap = [];

  // Get all segment files
  const files = (await readdir(dir)).filter(file => file.match(/^segment_\d+$/));
  files.sort(); // Ensure files are in correct order

  for (const filename of files) {
    const filePath = join(dir, filename);
    const fileData = await readFile(filePath);

    // Create SHA-256 hash
    const hash = createHash('sha256').update(fileData).digest('hex');
    const newFilename = `${hash}.ts`;
    const newFilePath = join(dir, newFilename);

    // Rename file to its hash
    await rename(filePath, newFilePath);

    // Store mapping of original name to hash name (preserving order)
    segmentMap.push({ original: filename, hash: hash });
  }

  return segmentMap;
}

//-----------------------------------------------------------
// Update m3u8 file with hashed segment names
//-----------------------------------------------------------
async function updateM3u8WithHashes(dir, segmentMap) {
  const m3u8Path = join(dir, 'index.m3u8');
  let content = await readFile(m3u8Path, 'utf8');

  // Replace each segment filename with its hash
  for (const { original, hash } of segmentMap) {
    content = content.replace(new RegExp(original, 'g'), hash);
  }

  // The key will be provided in the Nostr event's key tag,
  // so we can replace the key line with an empty string.
  // This is a placeholder approach since players will need to
  // get the key from the Nostr event anyway.
  content = content.replace(/#EXT-X-KEY:METHOD=AES-128,URI="enc\.key",IV=0x[0-9a-f]+\n/, '');

  await writeFile(m3u8Path, content);
}

//-----------------------------------------------------------
// Generate Nostr event
//-----------------------------------------------------------
function generateNostrEvent(key, segmentMap) {
  // Create base event structure (without id, created_at, sig)
  const event = {
    kind: 1663,
    tags: [],
    content: ""
  };

  // Add segments as x tags in order
  for (const segment of segmentMap) {
    event.tags.push(['x', segment.hash]);
  }

  // Add key tag (base64 encoded)
  const keyBase64 = key.toString('base64');
  event.tags.push(['aes_key', keyBase64]);

  return event;
}
