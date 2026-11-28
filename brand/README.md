# Lyno brand assets

| File | Size | Use |
|---|---|---|
| `lyno-x-profile.png` | 400×400 | X / Twitter profile picture (shown as a circle) |
| `lyno-x-header.png` | 1500×500 | X / Twitter header banner |
| `lyno-intro.mp4` | 1920×1080, 30 s, H.264 | "Introducing Lyno" launch video (no audio) |
| `lyno-coin.mp4` | 1080×1080, 12 s, seamless loop | Spinning $LYNO coin (rendered from `coin.html`) |
| `lyno-coin.gif` | 400×400, 15 fps | Same coin as a looping GIF for Telegram / Discord |
| `launch-post.md` | — | Launch post + thread copy (English and Indonesian) |

The PNGs are rendered from `profile.html` and `header.html`. To regenerate, put the source logo next to them as
`logo.webp`, open each page in a browser at exactly 400×400 / 1500×500 and take a screenshot.

The video is rendered frame by frame from `video.html` (each frame calls `window.render(t)`):

```bash
node render.cjs "$PWD/video.html" frames 30 30   # 900 JPEG frames into ./frames
ffmpeg -framerate 30 -i frames/%05d.jpg -c:v libx264 -profile:v high -crf 18 -pix_fmt yuv420p -movflags +faststart lyno-intro.mp4
```
