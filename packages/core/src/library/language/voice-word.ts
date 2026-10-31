import "server-only";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { generateLanguageAudio } from "../../audio/generate-language-audio";
import { toAudioData } from "./_utils/language-audio";

/** Internal, for the follow-up a pronunciation review owes. A failed voice throws, so the step retries. */
export async function voiceWord({
  orgSlug,
  targetLanguage,
  wordId,
}: {
  orgSlug: string;
  targetLanguage: string;
  wordId: string;
}): Promise<void> {
  if (!isTTSSupportedLanguage(targetLanguage)) {
    return;
  }

  const word = await prisma.word.findFirst({ where: { audioUrl: null, id: wordId } });

  if (!word) {
    return;
  }

  const { data, error } = await generateLanguageAudio({
    language: targetLanguage,
    orgSlug,
    text: word.word,
  });

  if (error) {
    throw error;
  }

  await prisma.word.updateMany({ data: toAudioData(data), where: { audioUrl: null, id: wordId } });
}
