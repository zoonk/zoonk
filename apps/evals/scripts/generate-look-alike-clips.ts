/**
 * Makes the labeled clips the check-word-pronunciation eval listens to, saved as
 * data/look-alike/<case id>.mp3: each look-alike word voiced by the app in its own language (with
 * its IPA and its check) and voiced as English. Clips that exist are kept, so this only spends on
 * new cases.
 *
 *   pnpm exec tsx --conditions=react-server --env-file=.env \
 *     --import ./scripts/register-markdown.mts scripts/generate-look-alike-clips.ts
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LOOK_ALIKE_CLIPS_DIR, TEST_CASES } from "@/tasks/check-word-pronunciation/test-cases";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { logInfo } from "@zoonk/utils/logger";

async function generateClip({ userInput }: (typeof TEST_CASES)[number]) {
  const file = path.join(LOOK_ALIKE_CLIPS_DIR, `${userInput.clipId}.mp3`);

  if (existsSync(file)) {
    return;
  }

  const { data, error } = await generateLanguageAudio({
    language: userInput.voicedAs,
    text: userInput.word,
  });

  if (error) {
    throw error;
  }

  await writeFile(file, data.audio);
  logInfo(`Saved ${file}`);
}

await mkdir(LOOK_ALIKE_CLIPS_DIR, { recursive: true });

for (const testCase of TEST_CASES) {
  // oxlint-disable-next-line no-await-in-loop -- One clip at a time keeps text-to-speech well under its rate limits.
  await generateClip(testCase);
}
