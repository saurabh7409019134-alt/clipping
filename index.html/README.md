# Stream Clipper
Paste a YouTube live/VOD link -> best moments -> 9:16 clips.

## Setup
1. Install Node 18+, `ffmpeg`, and `yt-dlp` (pip install -U yt-dlp)
2. `npm install`
3. Optional: copy `.env.example` to `.env.local`, add ANTHROPIC_API_KEY for AI titles/ranking
4. `npm run dev` -> http://localhost:3000

## How it scores
- Audio loudness spikes (ffmpeg) per 10s
- Live chat replay message-rate spikes (yt-dlp live_chat)
- Optional Claude ranking of transcript (auto captions)
- Top non-overlapping windows, center-cropped to 1080x1920 on demand

## Notes
- Best on ended streams (VOD); for a running stream, run after it ends.
- 3h+ streams take several minutes to analyze.
- Next: face-tracking crop, burned-in captions, job queue for hosting.
- Only clip content you own or have permission to reuse.
