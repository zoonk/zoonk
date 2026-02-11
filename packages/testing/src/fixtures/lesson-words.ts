import { prisma } from "@zoonk/db";

export async function lessonWordFixture(attrs: { lessonId: number; wordId: bigint }) {
  return prisma.lessonWord.create({
    data: { lessonId: attrs.lessonId, wordId: attrs.wordId },
  });
}
