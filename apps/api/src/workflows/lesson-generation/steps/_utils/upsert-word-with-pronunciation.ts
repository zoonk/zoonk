import { prisma } from "@zoonk/db";

export async function upsertWordWithPronunciation(params: {
  audioUrl: string | null;
  organizationId: string;
  pronunciation: string | null;
  romanization: string | null;
  romanizationUpdate: { romanization?: string | null };
  targetLanguage: string;
  userLanguage: string;
  word: string;
}): Promise<string> {
  const record = await prisma.word.upsert({
    create: {
      audioUrl: params.audioUrl,
      organizationId: params.organizationId,
      romanization: params.romanization,
      targetLanguage: params.targetLanguage,
      word: params.word,
    },
    update: {
      ...(params.audioUrl ? { audioUrl: params.audioUrl } : {}),
      ...params.romanizationUpdate,
    },
    where: {
      orgWord: {
        organizationId: params.organizationId,
        targetLanguage: params.targetLanguage,
        word: params.word,
      },
    },
  });

  if (params.pronunciation) {
    await prisma.wordPronunciation.upsert({
      create: {
        pronunciation: params.pronunciation,
        userLanguage: params.userLanguage,
        wordId: record.id,
      },
      update: { pronunciation: params.pronunciation },
      where: {
        wordPronunciation: {
          userLanguage: params.userLanguage,
          wordId: record.id,
        },
      },
    });
  }

  return record.id;
}
