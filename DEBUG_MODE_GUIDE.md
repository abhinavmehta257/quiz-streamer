# Debug Mode Guide

## Overview

The streaming engine now supports a **debug mode** that allows you to output videos locally instead of streaming to YouTube. This is useful for:
- Testing your stream setup without going live
- Creating local recordings for review
- Debugging visual or audio issues
- Recording content for later use

## How to Use

### Enable Debug Mode (Local Video Output)

1. Open `.env.local` file
2. Set `DEBUG_MODE=true`
3. Start your application as normal

```env
DEBUG_MODE=true
```

When debug mode is enabled:
- ✅ Video will be saved to `output/stream-{timestamp}.mp4`
- ✅ Uses `medium` preset for better quality
- ✅ No YouTube credentials needed
- ✅ All frames are rendered identically to live streaming

### Disable Debug Mode (YouTube Streaming)

1. Open `.env.local` file
2. Set `DEBUG_MODE=false` or remove the line entirely
3. Start your application as normal

```env
DEBUG_MODE=false
```

When debug mode is disabled:
- ✅ Video streams to YouTube Live via RTMP
- ✅ Uses `ultrafast` preset for low latency
- ✅ Requires YOUTUBE_STREAM_ID to be set
- ✅ Real-time streaming with optimized performance

## Output Location

Local debug videos are saved to:
```
output/stream-{timestamp}.mp4
```

Example: `output/stream-1711193856432.mp4`

The `output/` directory is automatically created and added to `.gitignore` so your videos won't be committed to version control.

## Technical Details

### Video Specifications
- Resolution: 720x1080 (vertical portrait)
- Frame rate: 18 FPS
- Video codec: H.264 (libx264)
- Audio codec: AAC, 128 kbps
- Audio source: background-music.mp3 (looped)
- Bitrate: 1500 kbps (target), 1800 kbps (max)

### Differences Between Modes

| Feature | Debug Mode | Streaming Mode |
|---------|-----------|----------------|
| Output | Local MP4 file | YouTube RTMP stream |
| Preset | `medium` | `ultrafast` |
| Quality | Higher | Optimized for latency |
| Credentials | Not required | Requires stream key |
| Use case | Testing/recording | Live streaming |

## Console Output

When starting, you'll see a clear indicator of which mode is active:

**Debug Mode:**
```
╔══════════════════════════════════════════════╗
║   🎬 DEBUG MODE - Local Video Output         ║
╚══════════════════════════════════════════════╝
[streamEngine] Output file: output/stream-1711193856432.mp4
```

**Streaming Mode:**
```
╔══════════════════════════════════════════════╗
║   📡 STREAMING MODE - YouTube Live           ║
╚══════════════════════════════════════════════╝
[streamEngine] RTMP URL: rtmp://...
```

## Tips

1. **Testing changes**: Use debug mode to quickly test visual changes without going live
2. **Creating demos**: Record in debug mode to create demo videos
3. **Quality comparison**: Debug mode uses higher quality encoding (medium preset)
4. **Disk space**: Remember to clean up old files in the `output/` directory
5. **File naming**: Files use timestamps, so they're automatically unique

## Troubleshooting

**Videos are not being created:**
- Check that the `output/` directory exists
- Ensure you have write permissions
- Check console for ffmpeg errors

**Video quality issues:**
- In debug mode, quality should be better than streaming
- Check that background-music.mp3 exists for audio

**Switching between modes:**
- Always restart the server after changing DEBUG_MODE
- Check console output to confirm which mode is active
