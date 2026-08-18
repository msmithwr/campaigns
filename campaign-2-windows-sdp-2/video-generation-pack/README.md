# Windows SDP2 Video Generation Pack

## Purpose

Create a 60-second bilingual animated explainer for the Windows EC2 SDP Campaign 2 landing page.

Working title:

`Why Move Windows to AWS with SDP`

## Source Of Truth

Primary source:

`../video-script.md`

Supporting page context:

`../landing-page-brief.md`

## Recommended Output

Produce two final exports:

1. `cloudwrxs-windows-sdp2-explainer-en.mp4`
   - English narration
   - Optional Arabic subtitles

2. `cloudwrxs-windows-sdp2-explainer-ar.mp4`
   - Arabic narration
   - Optional English subtitles

Both should be:

- 1920x1080
- 30fps
- MP4 H.264
- Under 50MB if possible for web use
- Suitable for embedding on `/windows-sdp2/`

## Grok Imagine Workflow

1. Generate the three reference stills first using `01-reference-still-prompts.md`.
2. Use those reference stills for every video clip generation.
3. Generate the video clips from `02-grok-clip-prompts.md`.
4. Download each clip with the exact file names listed in `03-clip-manifest.csv`.
5. Assemble the clips using the timings in `03-clip-manifest.csv`.
6. Add human-quality voiceover from `04-voiceover-scripts.md`.
7. Add subtitles using `05-subtitle-timing.srt` as the starting point.

Important: do not use Grok's generated audio in the final edit. Generate picture-only clips where possible, or mute the Grok audio during assembly. The final voice should be recorded separately by a human speaker or generated with a high-quality voice tool using the delivery notes in `04-voiceover-scripts.md`.

## Consistency Rules

- Keep the same corporate animation style across every clip.
- Avoid photorealistic people if it makes consistency harder; premium animated business illustration is preferred.
- Do not use fake, distorted, or incorrect logos. If exact logos cannot be used cleanly, use labelled text and simple brand-colour badges instead.
- Keep on-screen text minimal and readable.
- Keep generated clip audio off or muted; final audio is added separately.
- Avoid showing sensitive infrastructure diagrams or named customer data.
- Respect KSA/MENA business context without caricature.

## Visual Direction

Professional animated explainer, clean corporate motion graphics, modern Riyadh/KSA business setting, AWS orange, Cloudwrxs blue, Saudi green accents, Windows infrastructure diagrams, cloud transformation visuals, executive-friendly dashboards.

## Landing Page CTA

Final CTA should point to the calendar link configured in the website ACF field:

`https://calendar.google.com/calendar/u/0?cid=bWF0dGhldy5zbWl0aC13cmlnaHRAY2xvdWR3cnhzLmNvbQ`

Recommended visible CTA:

`Book your free Windows Migration Readiness Assessment`

Arabic visible CTA:

`احجز تقييم جاهزية ترحيل Windows مجاناً`

## Files In This Pack

- `01-reference-still-prompts.md`
- `02-grok-clip-prompts.md`
- `03-clip-manifest.csv`
- `04-voiceover-scripts.md`
- `05-subtitle-timing.srt`
- `06-assembly-notes.md`
