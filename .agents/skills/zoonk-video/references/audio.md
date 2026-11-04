# Audio

You can't listen. An audio-capable model judges, transcription checks the words, and loudness meters check the levels. Report the result as checked by those, not heard.

## AI Gateway from a Mac

- **Auth:** run every script from a Vercel-linked app folder, such as `cd apps/api`. The AI SDK then authenticates through the Vercel login (OIDC); no key goes in a file or the chat.
- **Models:** fetch the live list (`curl -fsSL https://ai-gateway.vercel.sh/v1/models`, filter `type: "speech"`) before choosing; models change.
- **Training opt-out:** ElevenLabs on the gateway rejects the app's `disallowPromptTraining`. Video scripts are public marketing copy, so `gen-audio.mjs` doesn't send it. Never send learner data through it.
- **Cost:** pennies. Narration for both cuts in both languages, music and the judging together cost well under $5.

## Narration

1. **Script.** Write the film's `narration.py` (see `example/zoonk-2/narration.py`): the model, the voice, per-language instructions, and per cut `(id, start s, scene end s, en, pt)` rows. A line may run past its scene's end into the next scene, never into the next line.
   - The voice complements the supers; it doesn't read them.
   - Spell out what TTS mangles: "Zoonk two point oh", "zoonk dot com", "dois ponto zero", "zoonk ponto com".
2. **Voice.** Gemini TTS `google/gemini-3.8-flash-tts` with the voice `Charon` won blind rankings in both languages, so one narrator covers both channels.
   - Pass `instructions`: warm, calm, confident, unhurried, never salesy.
   - Add pronunciation rules:
     - "Zoonk" is "zoo" + "nk" (IPA zuːŋk), never "zoom" or "zoot".
     - In pt, "zunk" with no vowel at the end, and "Zu" said "zú" without nasalizing.
     - Questions are read as questions.
3. **Generate.** `python3 scripts/narration.py <film> spec <spec.json>` lists every line and sample word. Then `cd <repo>/apps/api && node <studio>/scripts/gen-audio.mjs <spec.json> <film>/audio/vo [ids]`. It skips existing files unless ids are passed.
4. **Fit.** `python3 scripts/narration.py <film> fit` measures each clip's speech against its window, which ends 0.15 s before the next line starts. Shorten the copy or move starts until no line runs into the next one.
5. **Check the words.** `transcribe.mjs <spec.json> <film>/audio/vo` (`openai/gpt-4o-transcribe`) prints what each clip says next to the script.
   - Made-up names come back misspelled ("Zunk", "Zoom"). Confirm those with the judge instead (`judge-audio.mjs` with a "how is the brand pronounced, give IPA" prompt).
   - Real misreads ("by your day" for "by your date") need new wording, not retries.
6. **Pick voices fairly.** `rank-audio.mjs` has a strong position bias: the first clip tends to win. Run four shuffled orders and average the ranks.

## Music

- **Bed:** ElevenLabs `elevenlabs/music-v2.5` through the gateway, with `musicLengthMs` and `forceInstrumental` (see `example/zoonk-2/music.json`, run with `gen-audio.mjs` like the narration).
  - Describe the cue's structure in the prompt with timestamps: a quiet open, the lift at the logo, a steady understated bed, a soft end.
  - Output lengths vary (one 150 s request came back as 54 s), so check the duration and regenerate.
- **Choose:**
  - Measure the short-term loudness every 6 s with ffmpeg's `ebur128`. Reject beds that swing more than about 4 LU.
  - Have the judge rate whether it fits under narration and how annoying it is.
- **Avoid busy loops.** Looped "upbeat chillwave" from Apple Loops felt annoying to the owner.
- **One level.** Never dip the music by section; it reads as a glitch. `mix.py`:
  - auto-levels the bed (3 s window, at most ±4 dB)
  - ducks it 7 dB only under the voice
  - lowers it 3 dB under the last 16 s for the CTA

## UI sounds

- Use the app's own sounds, rebuilt from `packages/player/src/lesson/_utils/lesson-sounds.ts`: right answer E5→A5, lesson finished C–E–G, sine notes of 0.12 s.
- Keep keys, taps and swipes about 20 dB under the voice.
- Sample words in a language beat (for example "quedarse", "stay") come from Gemini TTS with a native accent, leveled with the narration minus 5 dB.

## Mix and deliver

- `node scripts/cues.mjs <film>/<cut>.html <w> <h> <film>/audio/cues-<cut>-<lang>.json lang=<lang>` writes the page's sound cues.
- `python3 scripts/mix.py <film> <cut> <lang> <music> <out.wav>` places the lines, levels the voice (2:1 above −30 dB), applies the music and the UI cues (`scripts/sfx.py`), and runs two-pass loudnorm to −14 LUFS / −1.5 dBTP.
- Judge the final mix (`judge-audio.mjs` with a mixer prompt) for balance, level jumps, crammed lines and artifacts, then fix what holds up.
- `python3 scripts/narration.py <film> srt <cut> <lang> <out.srt>` writes the captions from the same timings.
- **Remux** when only the audio changed: `ffmpeg -i video.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k`. No re-render is needed.
