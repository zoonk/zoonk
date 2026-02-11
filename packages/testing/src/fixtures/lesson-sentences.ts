import { prisma } from "@zoonk/db";

export async function lessonSentenceFixture(attrs: { lessonId: number; sentenceId: bigint }) {
  return prisma.lessonSentence.create({
    data: { lessonId: attrs.lessonId, sentenceId: attrs.sentenceId },
  });
}
