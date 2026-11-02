const MAX_TITLE_LENGTH = 200;
const MAX_LABEL_LENGTH = 80;

export type RawTargetCutoffFinding = {
  edition: string | null;
  /** When the source or the exam says (ENEM's 1000). */
  maxScore: number | null;
  quota: string | null;
  score: number | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: "found" | "unknown";
};

export type TargetCutoffFinding =
  | {
      edition: string | null;
      maxScore: number | null;
      quota: string | null;
      score: number;
      source: { title: string | null; url: string };
      status: "found";
    }
  | { edition: null; maxScore: null; quota: null; score: null; source: null; status: "unknown" };

const UNKNOWN: TargetCutoffFinding = {
  edition: null,
  maxScore: null,
  quota: null,
  score: null,
  source: null,
  status: "unknown",
};

function toLabel(value: string | null, length: number): string | null {
  return value?.trim().slice(0, length) || null;
}

/** A scale's top is a positive number; anything else says nothing about the scale. */
function toMaxScore(maxScore: number | null): number | null {
  return maxScore !== null && Number.isFinite(maxScore) && maxScore > 0 ? maxScore : null;
}

/** A cut-off is a positive score, and never above the scale's top when the scale says one. */
function isScore({ maxScore, score }: { maxScore: number | null; score: number | null }) {
  return (
    score !== null &&
    Number.isFinite(score) &&
    score > 0 &&
    (maxScore === null || score <= maxScore)
  );
}

/**
 * Anything but a real score from a page a search returned reads as not known: the app says nothing.
 */
export function toTargetCutoffFinding({
  isSearched,
  raw,
}: {
  /** An address on a site the search didn't return was invented. */
  isSearched: (url: string) => boolean;
  raw: RawTargetCutoffFinding;
}): TargetCutoffFinding {
  const url = raw.sourceUrl?.trim();
  const maxScore = toMaxScore(raw.maxScore);

  if (
    raw.status !== "found" ||
    raw.score === null ||
    !isScore({ maxScore, score: raw.score }) ||
    !url ||
    !URL.canParse(url) ||
    !isSearched(url)
  ) {
    return UNKNOWN;
  }

  return {
    edition: toLabel(raw.edition, MAX_LABEL_LENGTH),
    maxScore,
    quota: toLabel(raw.quota, MAX_LABEL_LENGTH),
    score: raw.score,
    source: { title: toLabel(raw.sourceTitle, MAX_TITLE_LENGTH), url },
    status: "found",
  };
}
