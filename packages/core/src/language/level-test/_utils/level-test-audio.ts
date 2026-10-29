import "server-only";
import { prisma } from "@zoonk/db";
import { getBaseLanguage, isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { voiceSpeechClip } from "../../../audio/_utils/speech-clips";
import { normalizeSpeechText } from "../../../audio/speech-clip-contract";
import { getSpeechClipKey } from "../../../audio/speech-clip-key";
import { type LevelTestBank } from "../level-test-contract";
import { type LanguagePair, type LevelTestBankAnalytics } from "./level-test-bank";

type AudioBank = { bank: LevelTestBank; pair: LanguagePair };

function getAudioTargets({ bank, pair }: AudioBank) {
  const language = pair.targetLanguage;

  if (!isTTSSupportedLanguage(getBaseLanguage(language))) {
    return [];
  }

  const passages = new Set(
    bank.questions
      .filter((question) => question.skill === "listening")
      .map((question) => normalizeSpeechText(question.passage)),
  );

  return [...passages].map((text) => ({
    language,
    reuseKey: getSpeechClipKey({ language, text }),
    text,
  }));
}

export async function hasLevelTestAudio(input: AudioBank): Promise<boolean> {
  const targets = getAudioTargets(input);

  if (targets.length === 0) {
    return true;
  }

  const clips = await prisma.mediaAsset.findMany({
    select: { reuseKey: true },
    where: { reuseKey: { in: targets.map((target) => target.reuseKey) } },
  });

  return clips.length === targets.length;
}

async function clearAudioPreparation({
  audioStartedAt,
  bank,
  pair,
}: AudioBank & { audioStartedAt: string }): Promise<void> {
  await prisma.languageLevelTest.updateMany({
    data: { content: { questions: bank.questions, speaking: bank.speaking } },
    where: { ...pair, content: { equals: audioStartedAt, path: ["audioStartedAt"] } },
  });
}

export async function prepareLevelTestAudio({
  analytics,
  ...input
}: AudioBank & { analytics: LevelTestBankAnalytics }): Promise<void> {
  if (await hasLevelTestAudio(input)) {
    if (input.bank.audioStartedAt) {
      await clearAudioPreparation({ ...input, audioStartedAt: input.bank.audioStartedAt });
    }

    return;
  }

  const { bank, pair } = input;
  const audioStartedAt = new Date().toISOString();
  const content = { questions: bank.questions, speaking: bank.speaking };

  await prisma.languageLevelTest.updateMany({
    data: { content: { ...content, audioStartedAt } },
    where: pair,
  });

  try {
    const clips = await Promise.allSettled(
      getAudioTargets(input).map((target) =>
        voiceSpeechClip({ ...target, analytics, ownerId: null }),
      ),
    );

    if (clips.some((clip) => clip.status === "rejected" || !clip.value)) {
      throw new Error("Could not prepare placement audio");
    }
  } finally {
    await clearAudioPreparation({ ...input, audioStartedAt });
  }
}
