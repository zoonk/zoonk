import "server-only";
import { prisma } from "@zoonk/db";

const MAX_REFERENCE_CHARACTERS = 30_000;
const MAX_REFERENCES = 3;

const REFERENCE_SELECT = { extractedText: true, title: true } as const;

/** A product goal's references are its product's official pages, which no learner row links. */
export async function listGoalReferences({
  goalId,
  productId,
}: {
  goalId: string;
  productId: string | null;
}): Promise<{ text: string; title: string }[]> {
  const [linked, product] = await Promise.all([
    prisma.learnerSource.findMany({
      orderBy: { createdAt: "asc" },
      select: { source: { select: REFERENCE_SELECT } },
      take: MAX_REFERENCES,
      where: { goalId, source: { extractedText: { not: null } } },
    }),
    productId
      ? prisma.source.findMany({
          orderBy: { createdAt: "asc" },
          select: REFERENCE_SELECT,
          take: MAX_REFERENCES,
          where: { extractedText: { not: null }, productId },
        })
      : [],
  ]);

  return [...linked.map(({ source }) => source), ...product]
    .slice(0, MAX_REFERENCES)
    .flatMap((source) =>
      source.extractedText
        ? [{ text: source.extractedText.slice(0, MAX_REFERENCE_CHARACTERS), title: source.title }]
        : [],
    );
}
