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
    ["url", "http://server1.example.com"],
    ["url", "http://server2.example.com"],
    ["x", "segment_000.ts"],
    ["x", "segment_001.ts"],
    ["key", "BASE64_ENCRYPTION_KEY"]
  ],
  "content": "M3U8 Playlist Configuration"
}
```

- Each `url` tag specifies a server to check for segments
- Each `x` tag specifies a segment filename (in order)
- The `key` tag provides the encryption key in Base64 format

