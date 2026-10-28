const MAX_TITLE_LENGTH = 200;
const MAX_EDITION_LENGTH = 80;

/** Fewer than two options isn't a choice; more than this isn't a printed exam's question. */
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export type RawChoiceOptionsFinding = {
  edition: string | null;
  options: number | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: "found" | "unknown";
};

export type ChoiceOptionsFinding =
  | {
      edition: string | null;
      options: number;
      source: { title: string | null; url: string };
      status: "found";
    }
  | { edition: null; options: null; source: null; status: "unknown" };

const UNKNOWN: ChoiceOptionsFinding = {
  edition: null,
  options: null,
  source: null,
  status: "unknown",
};

function isOptionCount(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= MIN_OPTIONS && value <= MAX_OPTIONS;
}

/** Anything but a whole number from a page a search returned reads as not known, never a guess. */
export function toChoiceOptionsFinding({
  isSearched,
  raw,
}: {
  /** An address on a site the search didn't return was invented. */
  isSearched: (url: string) => boolean;
  raw: RawChoiceOptionsFinding;
}): ChoiceOptionsFinding {
  const url = raw.sourceUrl?.trim();

  if (
    raw.status !== "found" ||
    !isOptionCount(raw.options) ||
    !url ||
    !URL.canParse(url) ||
    !isSearched(url)
  ) {
    return UNKNOWN;
  }

  return {
    edition: raw.edition?.trim().slice(0, MAX_EDITION_LENGTH) || null,
    options: raw.options,
    source: { title: raw.sourceTitle?.trim().slice(0, MAX_TITLE_LENGTH) || null, url },
    status: "found",
  };
}
