import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PRONUNCIATION_CLIP_CASES } from "@/tasks/assess-pronunciation/test-cases";
import { SPEECH_CLIPS_DIR } from "@/tasks/transcribe-speech/task";
import { TEST_CASES } from "@/tasks/transcribe-speech/test-cases";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { logInfo } from "@zoonk/utils/logger";

type SpeechClip = { id: string; userInput: { language: string; spokenText: string } };

const CLIPS: SpeechClip[] = [...TEST_CASES, ...PRONUNCIATION_CLIP_CASES];

async function generateClip(testCase: SpeechClip) {
  const file = path.join(SPEECH_CLIPS_DIR, `${testCase.id}.mp3`);

  if (existsSync(file)) {
    return;
  }

  const { data, error } = await generateLanguageAudio({
    language: testCase.userInput.language,
    text: testCase.userInput.spokenText,
  });

  if (error) {
    throw error;
  }

  await writeFile(file, data.audio);
  logInfo(`Saved ${file}`);
}

await mkdir(SPEECH_CLIPS_DIR, { recursive: true });

for (const testCase of CLIPS) {
  // oxlint-disable-next-line no-await-in-loop -- One clip at a time keeps text-to-speech well under its rate limits.
  await generateClip(testCase);
}
