import "server-only";
import { getBaseLanguage, isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { voiceSpeechClip } from "../../audio/_utils/speech-clips";
import { normalizeSpeechText } from "../../audio/speech-clip-contract";
import { getSpeechClipKey } from "../../audio/speech-clip-key";
import {
  type LanguagePair,
  type LevelTestBankAnalytics,
  findBankRow,
  readBank,
} from "./_utils/level-test-bank";

/** System workflow capability without a learner session; never call from a render or GET. */
export async function prepareLevelTestBankAudio({
  analytics = {},
  pair,
}: {
  analytics?: LevelTestBankAnalytics;
  pair: LanguagePair;
}): Promise<void> {
  const language = pair.targetLanguage;

  if (!isTTSSupportedLanguage(getBaseLanguage(language))) {
    return;
  }

  const bank = readBank(await findBankRow(pair));

  if (!bank) {
    throw new Error("The placement question bank is not ready");
  }

  const passages = new Set(
    bank.questions
      .filter((question) => question.skill === "listening")
      .map((question) => normalizeSpeechText(question.passage)),
  );

  const clips = await Promise.allSettled(
    [...passages].map((text) =>
      voiceSpeechClip({
        analytics,
        language,
        ownerId: null,
        reuseKey: getSpeechClipKey({ language, text }),
        text,
      }),
    ),
  );

  if (clips.some((clip) => clip.status === "rejected" || !clip.value)) {
    throw new Error("Could not prepare placement audio");
  }
}
