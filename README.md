# n2m3u8

A tool to generate m3u8 playlists from Nostr kind 1663 events.

Kind 1663 is an experimental kind that aggregates data chunks and Blossom servers where they could possibly be located. For now it's MPEG-TS segments to produce an HLS stream.

Inspired by [Usenet NZB files](https://www.usenet.com/nzb/).

## Usage

```bash
cat config.json | node n2m3u8.js
```

### Full example

1. Fetch the nostr event with servers and hashes of encrypted video chunks
1. Use this tool `n2m3u8` to find files in specified Blossom servers, and turn that into a m3u8 playlist
1. Feed the playlist to ffmpeg which will load/decrypt the video segments
1. Output can be piped into mpv (use `mpv -`), VLC (`vlc -`) or just saved as file

```bash
nak req --id ec1688e87843e8774d1813c371fe65af890be090bdb831f03ceefdd2144ad679 wss://relay.damus.io | npx --yes github:franzaps/n2m3u8 | ffmpeg -f hls -allowed_extensions ALL -protocol_whitelist file,http,https,tcp,tls,crypto,fd -i - -f mpegts - | mpv -
```

## Kind 1663: Blossom HLS playlists

```jsonc
{
  "kind": 1663,
  "tags": [
    // HLS playlist mime type
    ["m", "application/vnd.apple.mpegurl"],
    // Blossom servers 
    ["url", "https://cdn1.blossom"],
    ["url", "https://cdn2.blossom"],
    ["url", "https://cdn3.blossom"],
    // Segments: [hash, Blossom server hint]
    ["x", "350520f08425f983a77524c3f343d3c117eafd52eeff9d0433723a190e47ddda", "https://cdn2.blossom"],
    ["x", "7b2781d3b782979a688171042c25ea9d6092cff9ac5f52dc657f5ce1908bcead"],
    ["x", "27a279159b7d30a0f24066080e5c22eeb7f02700962030bbb79dda33bafa1833"],
    ["x", "7303e57d6608b1c33da6c7297951666ff35d63daa903910e5b74fd7318325719"],
    ["x", "0a976bf40d71e5c4b84007139789a10e9a858a0275e4d40846199812034619aa", "https://cdn3.blossom"],
    ["x", "1d100c65fe251515bf7071201262f40332a61bd3897b862de65cf010f5a67765"],
    ["x", "6d673f0f60adee401d10ede051fe6a0e99c8055c86872d03a89e31347c24d297"],
    ["x", "071a76e2218f61698ee871ad30672068ddab00f60fbfdeb3ac386b3ab72a0e53"],
    ["x", "9a03029dd3f06bada54c67800dd2e7f552c9def8e57b41290588d58b056131d5"],
    ["aes_key", "KWv8iYnP6uOFm4bbRa9CGg=="]
  ],
  "content": "#EXTM3U#EXT-X-VERSION:3#EXT-X-TARGETDURATION:7#EXT-X-MEDIA-SEQUENCE:0#EXT-X-PLAYLIST-TYPE:VOD#EXTINF:7.200000,350520f08425f983a77524c3f343d3c117eafd52eeff9d0433723a190e47ddda#EXTINF:4.840000,7b2781d3b782979a688171042c25ea9d6092cff9ac5f52dc657f5ce1908bcead#EXTINF:7.000000,27a279159b7d30a0f24066080e5c22eeb7f02700962030bbb79dda33bafa1833#EXTINF:5.480000,7303e57d6608b1c33da6c7297951666ff35d63daa903910e5b74fd7318325719#EXTINF:5.920000,0a976bf40d71e5c4b84007139789a10e9a858a0275e4d40846199812034619aa#EXTINF:6.040000,1d100c65fe251515bf7071201262f40332a61bd3897b862de65cf010f5a67765#EXTINF:5.840000,6d673f0f60adee401d10ede051fe6a0e99c8055c86872d03a89e31347c24d297#EXTINF:6.720000,071a76e2218f61698ee871ad30672068ddab00f60fbfdeb3ac386b3ab72a0e53#EXTINF:1.400000,9a03029dd3f06bada54c67800dd2e7f552c9def8e57b41290588d58b056131d5#EXT-X-ENDLIST"
}
```

- Content has the m3u8 index information, all filenames MUST be hashes, which will be looked up by exact match in `x` tags. NOTE: This is _not_ a master m3u8.
- Each `x` tag specifies a segment hash, plus EXTINF and a Blossom relay hint (tags are in order)
- Each `url` tag specifies a Blossom server to check for segments, starting from first to last
- The optional `aes_key` tag provides the AES-128-CBC key in base64 format to decrypt the content (segements can still be encrypted but the key provided out of band), if present `#EXT-X-KEY:METHOD=AES-128,URI="file:///tmp/enc.key",IV=0x00000000000000000000000000000000` will be injected in the resulting m3u8
