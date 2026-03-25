import { prisma } from "@zoonk/db";

export async function fetchExistingWordCasing(params: {
  organizationId: number;
  targetLanguage: string;
  words: string[];
}): Promise<Record<string, string>> {
  const existing = await prisma.word.findMany({
    select: { word: true },
    where: {
      organizationId: params.organizationId,
      targetLanguage: params.targetLanguage,
      word: { in: params.words, mode: "insensitive" },
    },
  });

  return Object.fromEntries(existing.map((record) => [record.word.toLowerCase(), record.word]));
}
