# Formats

These numbers come from platform docs and creator research, gathered in November 2026. Re-check the platform pages when a number matters for a decision. Specs change.

## YouTube (16:9)

- **Length:** a full product film runs about 2–2:45. The research sweet spot for product overviews is 1–5 minutes. Brand on screen within about 10 s; the payoff (what the product does) within 5–15 s.
- **End screen:**
  - Hold the CTA for the last 12–20 s: YouTube allows 5–20 s, and the video must be at least 25 s long.
  - Keep the right half quiet so end-screen elements can sit there.
- **Chapters:** timestamps in the description, the first at 0:00, at least three, each 10 s or longer.
- **Export:**
  - 3840×2160 at 60 fps, H.264 High, closed GOP of half the frame rate, 2 B-frames, yuv420p, BT.709 tags.
  - AAC 48 kHz.
  - A 4K upload gets a better YouTube encode even for 1080p viewers.
- **Captions:** upload the `.srt` for each language.
- **Thumbnail:** 1280×720 PNG, under 2 MB. Brand, a short headline and a real screen. YouTube's "Test & compare" can try variants.

## Instagram Reels and TikTok (9:16)

- **Length:** 30–45 s for a product cut. Reels engage best at 45–60 s; TikTok's top ads often run 21–34 s.
- **Hook:** the brand and the promise in the first 1–3 s, on screen from frame 0.
- **Safe box:** keep text and the CTA inside x 120–960, y 270–1250 on 1080×1920.
  - The top 270 px holds the platform's tabs.
  - The bottom 670 px holds captions and buttons.
  - The right side holds TikTok's buttons from y≈840 down.
  - Phones and imagery may extend outside the box.
- **Sound:** most Reels and TikToks are watched with sound on, but the story must read with sound off, so supers stay even with narration.
- **Loop:** end on the first frame's state, so the replay counts.
- **CTA:** links in captions don't click. Say "zoonk.com" on screen and in the voice, and add a pinned comment.
- **Export:** 1080×1920, 60 fps, H.264 High, AAC 48 kHz, rendered at 2× and downscaled with lanczos.

## Loudness

- −14 LUFS integrated, −1.5 dBTP, for every cut.
- Two-pass `loudnorm` with `linear=true` (see `scripts/mix.py`).

## Reading time

A super stays up for about 0.28 s per word plus 0.6 s (minimum about 1.8 s), with sublines of 10 words or fewer. That gives a deliberate pace without dragging. The first cut used 0.35 s plus 1 s and the owner found it sluggish. A narrated 16:9 film shows no headlines on product scenes ([composition](story.md#composition)).
