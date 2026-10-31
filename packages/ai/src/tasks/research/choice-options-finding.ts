import { isFromCurrentBoard } from "@zoonk/utils/exam-boards";

const MAX_TITLE_LENGTH = 200;
const MAX_EDITION_LENGTH = 80;

/** Fewer than two options isn't a choice; more than this isn't a printed exam's question. */
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export type RawChoiceOptionsFinding = {
  /** Who ran the edition the options are from. */
  board: string | null;
  edition: string | null;
  options: number | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: "found" | "unknown";
};

export type ChoiceOptionsFinding =
  | {
      board: string | null;
      edition: string | null;
      options: number;
      source: { title: string | null; url: string };
      status: "found";
    }
  | { board: null; edition: null; options: null; source: null; status: "unknown" };

const UNKNOWN: ChoiceOptionsFinding = {
  board: null,
  edition: null,
  options: null,
  source: null,
  status: "unknown",
};

function isOptionCount(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= MIN_OPTIONS && value <= MAX_OPTIONS;
}

/**
 * Only a whole number from a page a search returned, for an edition the current board ran when
 * it's known; anything else reads as not known, never a guess.
 */
export function toChoiceOptionsFinding({
  board,
  isSearched,
  raw,
}: {
  board: string | null;
  /** An address on a site the search didn't return was invented. */
  isSearched: (url: string) => boolean;
  raw: RawChoiceOptionsFinding;
}): ChoiceOptionsFinding {
  const url = raw.sourceUrl?.trim();
  const countedBoard = raw.board?.trim() || null;

  if (
    raw.status !== "found" ||
    !isOptionCount(raw.options) ||
    !url ||
    !URL.canParse(url) ||
    !isSearched(url) ||
    !isFromCurrentBoard({ board: countedBoard, current: board })
  ) {
    return UNKNOWN;
  }

  return {
    board: countedBoard,
    edition: raw.edition?.trim().slice(0, MAX_EDITION_LENGTH) || null,
    options: raw.options,
    source: { title: raw.sourceTitle?.trim().slice(0, MAX_TITLE_LENGTH) || null, url },
    status: "found",
  };
}
