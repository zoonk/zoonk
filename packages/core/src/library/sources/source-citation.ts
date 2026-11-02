import { type Source } from "@zoonk/db";

export type SourceCitation = {
  checkedAt: Date;
  publisher: string | null;
  title: string;
  url: string | null;
};

export type ItemCitation = {
  checkedAt: Date | null;
  publisher: string | null;
  text: string;
  title: string | null;
  url: string | null;
};

type CitedSource = Pick<Source, "fetchedAt" | "publisher" | "title" | "url">;

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
