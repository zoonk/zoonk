import { prisma } from "@zoonk/db";

export async function wordAudioFixture(attrs: {
  organizationId: number;
  targetLanguage?: string;
  word?: string;
  audioUrl?: string;
}) {
  return prisma.wordAudio.create({
    data: {
      audioUrl: attrs.audioUrl ?? `https://example.com/${crypto.randomUUID()}.mp3`,
      organizationId: attrs.organizationId,
      targetLanguage: attrs.targetLanguage ?? "es",
      word: attrs.word ?? `word-${crypto.randomUUID()}`,
    },
  });
}

export async function wordFixture(attrs: {
  alternativeTranslations?: string[];
  organizationId: number;
  word?: string;
  translation?: string;
  targetLanguage?: string;
  userLanguage?: string;
  pronunciation?: string | null;
  romanization?: string | null;
  wordAudioId?: bigint | null;
}) {
  return prisma.word.create({
    data: {
      alternativeTranslations: attrs.alternativeTranslations ?? [],
      organizationId: attrs.organizationId,
      pronunciation: attrs.pronunciation ?? "test-pronunciation",
      romanization: attrs.romanization ?? null,
      targetLanguage: attrs.targetLanguage ?? "es",
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      userLanguage: attrs.userLanguage ?? "en",
      word: attrs.word ?? `word-${crypto.randomUUID()}`,
      wordAudioId: attrs.wordAudioId ?? null,
    },
    include: { wordAudio: true },
  });
}
