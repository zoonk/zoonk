const MAX_TITLE_LENGTH = 200;
const MAX_LABEL_LENGTH = 80;

/** The lookup's answer as the model gave it. */
export type RawTargetCutoffFinding = {
  edition: string | null;
  /** The highest score the exam's scale allows, when the source or the exam says (ENEM's 1000). */
  maxScore: number | null;
  quota: string | null;
  score: number | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: "found" | "unknown";
};

/** The last published cut-off of the learner's target, with where it came from. */
export type TargetCutoffFinding =
  | {
      edition: string | null;
      quota: string | null;
      score: number;
      source: { title: string | null; url: string };
      status: "found";
    }
  | { edition: null; quota: null; score: null; source: null; status: "unknown" };

const UNKNOWN: TargetCutoffFinding = {
  edition: null,
  quota: null,
  score: null,
  source: null,
  status: "unknown",
};

function toLabel(value: string | null, length: number): string | null {
  return value?.trim().slice(0, length) || null;
}

/** A cut-off is a positive score, and never above the scale's top when the scale says one. */
function isScore({ maxScore, score }: { maxScore: number | null; score: number | null }) {
  return (
    score !== null &&
    Number.isFinite(score) &&
    score > 0 &&
    (maxScore === null || !Number.isFinite(maxScore) || score <= maxScore)
  );
}

/**
 * Keeps only a cut-off a learner can compare their target with: a real score from a page a search
 * actually returned. Anything else reads as not known, never as a guess, so the app says nothing.
 */
export function toTargetCutoffFinding({
  isSearched,
  raw,
}: {
  /** Whether an address is on a site the search returned; anything else was invented. */
  isSearched: (url: string) => boolean;
  raw: RawTargetCutoffFinding;
}): TargetCutoffFinding {
  const url = raw.sourceUrl?.trim();

  if (
    raw.status !== "found" ||
    raw.score === null ||
    !isScore(raw) ||
    !url ||
    !URL.canParse(url) ||
    !isSearched(url)
  ) {
    return UNKNOWN;
  }

  return {
    edition: toLabel(raw.edition, MAX_LABEL_LENGTH),
    quota: toLabel(raw.quota, MAX_LABEL_LENGTH),
    score: raw.score,
    source: { title: toLabel(raw.sourceTitle, MAX_TITLE_LENGTH), url },
    status: "found",
  };
}
