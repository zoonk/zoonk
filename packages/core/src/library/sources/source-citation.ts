import { type Source } from "@zoonk/db";

/**
 * A public document a lesson screen or a question was built from, as its dated "Sources" chip
 * shows it. `checkedAt` is when the app last fetched the document and found it current, so
 * "Checked Sep 2026" stays honest as freshness checks run.
 */
export type SourceCitation = {
  checkedAt: Date;
  publisher: string | null;
  title: string;
  url: string | null;
};

/**
 * A question's citation: the passage it quotes or comes from ("Lei nº 8.112, Art. 13", a past
 * exam) and, when the passage's document is stored, that document's dated source fields.
 */
export type ItemCitation = {
  checkedAt: Date | null;
  publisher: string | null;
  text: string;
  title: string | null;
  url: string | null;
};

type CitedSource = Pick<Source, "fetchedAt" | "publisher" | "title" | "url">;

/** What a citation reads from its source row, for Prisma selects. */
export const citedSourceSelect = {
  fetchedAt: true,
  publisher: true,
  title: true,
  url: true,
} as const;

export function toSourceCitation(source: CitedSource): SourceCitation {
  return {
    checkedAt: source.fetchedAt,
    publisher: source.publisher,
    title: source.title,
    url: source.url,
  };
}

/** A stored item's citation, or null for an item that quotes nothing. */
export function toItemCitation({
  source,
  sourceCitation,
}: {
  source: CitedSource | null;
  sourceCitation: string | null;
}): ItemCitation | null {
  if (!sourceCitation) {
    return null;
  }

  return {
    checkedAt: source?.fetchedAt ?? null,
    publisher: source?.publisher ?? null,
    text: sourceCitation,
    title: source?.title ?? null,
    url: source?.url ?? null,
  };
}
