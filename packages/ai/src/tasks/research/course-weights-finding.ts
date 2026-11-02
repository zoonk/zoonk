const MAX_TITLE_LENGTH = 200;
const MAX_EDITION_LENGTH = 80;

/** No selection weighs a part ten times another: a bigger number is a score, not a weight. */
const MAX_WEIGHT = 10;

/** Weights by the part's number in `SUBJECTS`. */
export type RawCourseWeightsFinding = {
  edition: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: "found" | "unknown";
  weights: { subject: number; weight: number }[];
};

export type CourseWeightsFinding =
  | {
      edition: string | null;
      source: { title: string | null; url: string };
      status: "found";
      weights: number[];
    }
  | { edition: null; source: null; status: "unknown"; weights: [] };

const UNKNOWN: CourseWeightsFinding = {
  edition: null,
  source: null,
  status: "unknown",
  weights: [],
};

function isWeight(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_WEIGHT;
}

/** Null when a part has none, two or an impossible one. */
function toWeights({
  subjectCount,
  weights,
}: {
  subjectCount: number;
  weights: RawCourseWeightsFinding["weights"];
}): number[] | null {
  const matches = Array.from({ length: subjectCount }, (_, index) =>
    weights.filter((entry) => entry.subject === index + 1),
  );

  if (matches.some((entries) => entries.length !== 1)) {
    return null;
  }

  const values = matches.flatMap((entries) => entries.map((entry) => entry.weight));
  return values.every((value) => isWeight(value)) ? values : null;
}

/** Anything but a weight for every part, from a page a search returned, reads as not known. */
export function toCourseWeightsFinding({
  isSearched,
  raw,
  subjectCount,
}: {
  /** An address on a site the search didn't return was invented. */
  isSearched: (url: string) => boolean;
  raw: RawCourseWeightsFinding;
  subjectCount: number;
}): CourseWeightsFinding {
  if (raw.status !== "found") {
    return UNKNOWN;
  }

  const weights = toWeights({ subjectCount, weights: raw.weights });
  const url = raw.sourceUrl?.trim();

  if (!weights || !url || !URL.canParse(url) || !isSearched(url)) {
    return UNKNOWN;
  }

  return {
    edition: raw.edition?.trim().slice(0, MAX_EDITION_LENGTH) || null,
    source: { title: raw.sourceTitle?.trim().slice(0, MAX_TITLE_LENGTH) || null, url },
    status: "found",
    weights,
  };
}
