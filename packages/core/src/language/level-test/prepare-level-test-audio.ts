import "server-only";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
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
export async function listLevelTestPassagesToVoice(pair: LanguagePair): Promise<string[]> {
  const language = pair.targetLanguage;

  if (!isTTSSupportedLanguage(language)) {
    return [];
  }

  const bank = readBank(await findBankRow(pair));

  if (!bank) {
    throw new Error("The placement question bank is not ready");
  }

  const passages = [
    ...new Set(
      bank.questions
        .filter((question) => question.skill === "listening")
        .map((question) => normalizeSpeechText(question.passage)),
    ),
  ];

  const keys = new Map(passages.map((text) => [getSpeechClipKey({ language, text }), text]));

  const stored = await prisma.mediaAsset.findMany({
    select: { reuseKey: true },
    where: { reuseKey: { in: [...keys.keys()] } },
  });

  const voiced = new Set(stored.map((clip) => clip.reuseKey));
  return [...keys].flatMap(([key, text]) => (voiced.has(key) ? [] : [text]));
}

/** System workflow capability; throws when the clip couldn't be made, so its step retries it. */
export async function voiceLevelTestPassage({
  analytics = {},
  language,
  text,
}: {
  analytics?: LevelTestBankAnalytics;
  language: string;
  text: string;
}): Promise<void> {
  const clip = await voiceSpeechClip({
    analytics,
    language,
    ownerId: null,
    reuseKey: getSpeechClipKey({ language, text }),
    text,
  });

  if (!clip) {
    throw new Error("Could not voice a placement passage");
  }
}
