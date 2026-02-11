import { prisma } from "@zoonk/db";

export async function wordFixture(attrs: {
  organizationId: number;
  word?: string;
  translation?: string;
  targetLanguage?: string;
  userLanguage?: string;
  pronunciation?: string | null;
  romanization?: string | null;
  audioUrl?: string | null;
}) {
  return prisma.word.create({
    data: {
      audioUrl: attrs.audioUrl ?? null,
      organizationId: attrs.organizationId,
      pronunciation: attrs.pronunciation ?? "test-pronunciation",
      romanization: attrs.romanization ?? null,
      targetLanguage: attrs.targetLanguage ?? "es",
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      userLanguage: attrs.userLanguage ?? "en",
      word: attrs.word ?? `word-${crypto.randomUUID()}`,
    },
  });
}
