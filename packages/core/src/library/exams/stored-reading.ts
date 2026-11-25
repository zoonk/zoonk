import "server-only";
import { prisma } from "@zoonk/db";
import { type BlueprintContent, type Citation } from "./blueprint-contract";
import { carryConfirmedGaps } from "./confirmed-gaps";
import { isPassageInDocument } from "./passage-check";
import { isSameNotice, keepStoredFacts } from "./stored-facts";

/**
 * Whether the documents a reading read still hold a stored passage. A changed notice may live in a
 * new source, so a passage counts wherever the reading found it, and a document with no text proves
 * nothing.
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
    texts.some((text) => isPassageInDocument({ passage: citation.passage, text }));
}

/** A new reading over the stored one, keeping what the stored one found that the new one only missed. */
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
