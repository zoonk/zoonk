import "server-only";
import { prisma } from "@zoonk/db";
import { type BlueprintContent, type Citation } from "./blueprint-contract";
import { carryConfirmedGaps } from "./confirmed-gaps";
import { isPassageExactlyInDocument } from "./passage-check";
import { isSameNotice, keepStoredFacts } from "./stored-facts";

/**
 * A changed notice may live in a new source, so a passage counts in any document the reading read,
 * and only word for word: the near match a reading's own check allows reads "may use" in "may not use".
 */
async function loadCitedCheck({
  read,
  stored,
}: {
  read: BlueprintContent;
  stored: BlueprintContent;
}): Promise<(citation: Citation) => boolean> {
  if (isSameNotice({ read, stored })) {
    return () => true;
  }

  const sources = await prisma.source.findMany({
    select: { extractedText: true },
    where: { id: { in: read.edition.sourceIds ?? [] } },
  });

  const texts = sources.flatMap((source) => (source.extractedText ? [source.extractedText] : []));

  return (citation) =>
    texts.some((text) => isPassageExactlyInDocument({ passage: citation.passage, text }));
}

export async function readOverStored({
  read,
  stored,
}: {
  read: BlueprintContent;
  stored: BlueprintContent;
}): Promise<BlueprintContent> {
  const isCited = await loadCitedCheck({ read, stored });
  return keepStoredFacts({ isCited, read: carryConfirmedGaps({ next: read, stored }), stored });
}
