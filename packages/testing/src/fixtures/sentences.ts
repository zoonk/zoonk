import { prisma } from "@zoonk/db";

export async function sentenceFixture(attrs: {
  organizationId: number;
  sentence?: string;
  translation?: string;
  targetLanguage?: string;
  userLanguage?: string;
  romanization?: string | null;
  audioUrl?: string | null;
}) {
  return prisma.sentence.create({
    data: {
      audioUrl: attrs.audioUrl ?? null,
      organizationId: attrs.organizationId,
      romanization: attrs.romanization ?? null,
      sentence: attrs.sentence ?? `sentence-${crypto.randomUUID()}`,
      targetLanguage: attrs.targetLanguage ?? "es",
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      userLanguage: attrs.userLanguage ?? "en",
    },
  });
}
