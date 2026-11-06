import "server-only";
import { prisma } from "@zoonk/db";

const MAX_REFERENCE_CHARACTERS = 30_000;
const MAX_REFERENCES = 3;

const REFERENCE_SELECT = { extractedText: true, title: true } as const;

function loadSources({ goalId, productId }: { goalId: string; productId: string | null }) {
  if (productId) {
    return prisma.source.findMany({
      orderBy: { createdAt: "asc" },
      select: REFERENCE_SELECT,
      take: MAX_REFERENCES,
      where: { extractedText: { not: null }, productId },
    });
  }

  return prisma.learnerSource
    .findMany({
      orderBy: { createdAt: "asc" },
      select: { source: { select: REFERENCE_SELECT } },
      take: MAX_REFERENCES,
      where: { goalId, source: { extractedText: { not: null } } },
    })
    .then((linked) => linked.map(({ source }) => source));
}

/** A product goal's references are its product's official pages, which no learner row links. */
export async function listGoalReferences(input: {
  goalId: string;
  productId: string | null;
}): Promise<{ text: string; title: string }[]> {
  const sources = await loadSources(input);

  return sources.flatMap((source) =>
    source.extractedText
      ? [{ text: source.extractedText.slice(0, MAX_REFERENCE_CHARACTERS), title: source.title }]
      : [],
  );
}
