# n2m3u8

A tool to generate m3u8 playlists from Nostr kind 1663 events.

## Usage

```bash
nak req --id ec1688e87843e8774d1813c371fe65af890be090bdb831f03ceefdd2144ad679 wss://relay.damus.io | npx --yes github:franzaps/n2m3u8 | ffmpeg -f hls -allowed_extensions ALL -protocol_whitelist file,http,https,tcp,tls,crypto,fd -i - -f mpegts - | mpv -
```

```bash
# Locally
cat config.json | node n2m3u8.js | ffmpeg -f hls -allowed_extensions ALL -protocol_whitelist file,http,https,tcp,tls,crypto,fd -i - -f matroska - | mpv -
```

## Input Format

The tool expects a Nostr event of kind 1663 in JSON format as input. Example:

```json
{
  "kind": 1663,
  "tags": [
    // Blossom servers
    ["url", "https://cdn1.blossom"],
    ["url", "https://cdn2.blossom"],
    ["url", "https://cdn3.blossom"],
    // TS segments in order
    ["x", "0a976bf40d71e5c4b84007139789a10e9a858a0275e4d40846199812034619aa"],
    ["x", "9a03029dd3f06bada54c67800dd2e7f552c9def8e57b41290588d58b056131d5"],
    ["x", "350520f08425f983a77524c3f343d3c117eafd52eeff9d0433723a190e47ddda"],
    ["aes_key", "KWv8iYnP6uOFm4bbRa9CGg=="]
  ],
  "content": "Description of the video"
}
```

- Each `url` tag specifies a server to check for segments
- Each `x` tag specifies a segment filename (in order)
- The `aes_key` tag provides the AES-128-CBC encryption key in base64 format

