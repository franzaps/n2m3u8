# n2m3u8

A tool to generate m3u8 playlists from Nostr kind 1663 events.

Kind 1663 is an experimental kind that aggregates data chunks and Blossom servers where they could possibly be located. For now it's MPEG-TS segments to produce an HLS stream.

Inspired by [Usenet NZB files](https://www.usenet.com/nzb/).

## Usage

1. Fetch the nostr event with servers and hashes of encrypted video chunks
1. Use this tool `n2m3u8` to find files in specified Blossom servers, and turn that into a m3u8 playlist
1. Feed the playlist to ffmpeg which will load/decrypt the video segments
1. Output can be piped into mpv (use `mpv -`), VLC (`vlc -`) or just a file (end the ffmpeg command with `... -f mpegts out.mp4`)

```bash
nak req --id ec1688e87843e8774d1813c371fe65af890be090bdb831f03ceefdd2144ad679 wss://relay.damus.io | npx --yes github:franzaps/n2m3u8 | ffmpeg -f hls -allowed_extensions ALL -protocol_whitelist file,http,https,tcp,tls,crypto,fd -i - -f mpegts - | mpv -
```

```bash
# Locally
cat config.json | node n2m3u8.js | ffmpeg -f hls -allowed_extensions ALL -protocol_whitelist file,http,https,tcp,tls,crypto,fd -i - -f matroska - | mpv -
```

## Input Format

The tool expects a Nostr event of kind 1663 in JSON format as input. Example:

```jsonc
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

