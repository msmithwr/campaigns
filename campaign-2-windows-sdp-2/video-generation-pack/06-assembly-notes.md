# Assembly Notes

## Folder Layout

Recommended local working folders:

- `clips/raw/`
- `clips/approved/`
- `audio/`
- `subtitles/`
- `exports/`

## Clip Naming

Use the exact clip names from `03-clip-manifest.csv`.

## Assembly Steps

1. Download each Grok clip.
2. Place raw clips in `clips/raw/`.
3. Rename them to match the manifest.
4. Trim or extend each clip to the manifest duration.
5. Normalize all clips to:
   - 1920x1080
   - 30fps
   - H.264 MP4
6. Mute all generated clip audio.
7. Add light crossfades between scenes where useful.
8. Add English or Arabic narration.
9. Time the edit to the narration rather than forcing the narration to match awkward generated clip audio.
10. Add background music at low volume.
11. Add subtitles if required.
12. Overlay the official Cloudwrxs logo in the reserved safe area.
13. Export final MP4.

## Brand Accuracy Rule

Do not rely on Grok to render the Cloudwrxs wordmark. Grok should generate logo-free scenes with a clean safe area. During assembly, overlay the official Cloudwrxs logo from:

- `output/video-generation/grok-references/cloudwrxs-logo-light.png`
- `output/video-generation/grok-references/cloudwrxs-logo-dark.png`

Recommended overlay:

- Use the light logo on dark navy scenes.
- Use the dark logo on white or pale scenes.
- Keep the logo in the top-left safe area unless it conflicts with the scene.
- Use consistent size across all clips, approximately 16-20% of frame width.
- Fade the logo in over 8-12 frames on the first clip, then keep it static or use a very subtle opacity pulse only on the final CTA.

## Voiceover Pronunciation

The spoken brand pronunciation is "Cloud Works". Use the corrected voiceover files:

- English: `output/voice-generation/cloudwrxs-windows-sdp2-voiceover-en-ryan-cloudworks.mp3`
- Arabic: `output/voice-generation/cloudwrxs-windows-sdp2-voiceover-ar-hamed-cloudworks.mp3`

The Arabic voiceover is naturally longer than the English version. Extend the Arabic clip pacing to approximately 70-72 seconds rather than rushing the narration.

## FFmpeg Draft Command

After clips are normalized, create a file named `concat.txt`:

```text
file 'clip-01-riyadh-windows-problem.mp4'
file 'clip-02-licensing-cost-pressure.mp4'
file 'clip-03-operations-security-pressure.mp4'
file 'clip-04-aws-sdp-cloudwrxs-introduction.mp4'
file 'clip-05-cost-savings-benefit.mp4'
file 'clip-06-performance-benefit.mp4'
file 'clip-07-security-compliance-benefit.mp4'
file 'clip-08-operational-simplification.mp4'
file 'clip-09-proof-point-results.mp4'
file 'clip-10-book-free-assessment-cta.mp4'
```

Then:

```bash
ffmpeg -f concat -safe 0 -i concat.txt -c copy exports/cloudwrxs-windows-sdp2-explainer-picture-lock.mp4
```

If clip encoding differs, re-encode:

```bash
ffmpeg -f concat -safe 0 -i concat.txt -vf "scale=1920:1080,fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k exports/cloudwrxs-windows-sdp2-explainer-picture-lock.mp4
```

## Mute Grok Audio

If Grok generates audio with a clip, remove it before final assembly:

```bash
ffmpeg -i input-from-grok.mp4 -an -c:v copy output-muted.mp4
```

If the stream copy fails because the file encoding is awkward, re-encode:

```bash
ffmpeg -i input-from-grok.mp4 -an -vf "scale=1920:1080,fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 20 output-muted.mp4
```

## Notes On Text In Generated Video

Grok may distort small text. Prefer clean visual panels with minimal large text. Add final sharp text overlays during editing if needed.

Grok should not render the Cloudwrxs logo as text or a visual mark. If it does, reject that clip and regenerate with the logo-free prompt.

## Review Checklist

- Consistent visual style across all clips
- No distorted logos or unreadable text
- No awkward or culturally insensitive business imagery
- CTA clearly visible in final five seconds
- English and Arabic versions both feel native and polished
- Export is web-ready for `/windows-sdp2/`
