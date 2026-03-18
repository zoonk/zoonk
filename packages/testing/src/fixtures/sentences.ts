import { prisma } from "@zoonk/db";

export async function sentenceAudioFixture(attrs: {
  organizationId: number;
  targetLanguage?: string;
  sentence?: string;
  audioUrl?: string;
}) {
  return prisma.sentenceAudio.create({
    data: {
      audioUrl: attrs.audioUrl ?? `https://example.com/${crypto.randomUUID()}.mp3`,
      organizationId: attrs.organizationId,
      sentence: attrs.sentence ?? `sentence-${crypto.randomUUID()}`,
      targetLanguage: attrs.targetLanguage ?? "es",
    },
  });
}

export async function sentenceFixture(attrs: {
  alternativeSentences?: string[];
  alternativeTranslations?: string[];
  organizationId: number;
  sentence?: string;
  translation?: string;
  targetLanguage?: string;
  userLanguage?: string;
  romanization?: string | null;
  sentenceAudioId?: bigint | null;
}) {
  return prisma.sentence.create({
    data: {
      alternativeSentences: attrs.alternativeSentences ?? [],
      alternativeTranslations: attrs.alternativeTranslations ?? [],
      organizationId: attrs.organizationId,
      romanization: attrs.romanization ?? null,
      sentence: attrs.sentence ?? `sentence-${crypto.randomUUID()}`,
      sentenceAudioId: attrs.sentenceAudioId ?? null,
      targetLanguage: attrs.targetLanguage ?? "es",
      translation: attrs.translation ?? `translation-${crypto.randomUUID()}`,
      userLanguage: attrs.userLanguage ?? "en",
    },
    include: { sentenceAudio: true },
  });
}
