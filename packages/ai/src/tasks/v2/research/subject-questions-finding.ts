const MAX_TITLE_LENGTH = 200;
const MAX_EDITION_LENGTH = 80;

/** The lookup's answer as the model gave it: counts by the subject's number in `SUBJECTS`. */
export type RawSubjectQuestionsFinding = {
  counts: { questions: number; subject: number }[];
  edition: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: "found" | "unknown";
};

/** Each subject's questions in the order the subjects were asked, with where they came from. */
export type SubjectQuestionsFinding =
  | {
      edition: string | null;
      questions: number[];
      source: { title: string | null; url: string };
      status: "found";
    }
  | { edition: null; questions: []; source: null; status: "unknown" };

const UNKNOWN: SubjectQuestionsFinding = {
  edition: null,
  questions: [],
  source: null,
  status: "unknown",
};

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** One count per subject, in their order, or null when a subject has none or two. */
function toQuestions({
  counts,
  subjectCount,
}: {
  counts: RawSubjectQuestionsFinding["counts"];
  subjectCount: number;
}): number[] | null {
  const questions = Array.from({ length: subjectCount }, (_, index) =>
    counts.filter((count) => count.subject === index + 1),
  );

  if (questions.some((matches) => matches.length !== 1)) {
    return null;
  }

  const values = questions.flatMap((matches) => matches.map((count) => count.questions));

  return values.every((value) => isCount(value)) && values.some((value) => value > 0)
    ? values
    : null;
}

/**
 * Keeps only counts a learner can plan by: one for every subject, from a page a search actually
 * returned, adding up to the exam's total when the notice gives one. Anything else reads as not
 * known, never as a guess.
 */
export function toSubjectQuestionsFinding({
  isSearched,
  raw,
  subjectCount,
  total,
}: {
  /** Whether an address is on a site the search returned; anything else was invented. */
  isSearched: (url: string) => boolean;
  raw: RawSubjectQuestionsFinding;
  subjectCount: number;
  total: number | null;
}): SubjectQuestionsFinding {
  if (raw.status !== "found") {
    return UNKNOWN;
  }

  const questions = toQuestions({ counts: raw.counts, subjectCount });
  const url = raw.sourceUrl?.trim();

  if (!questions || !url || !URL.canParse(url) || !isSearched(url)) {
    return UNKNOWN;
  }

  if (total !== null && questions.reduce((sum, value) => sum + value, 0) !== total) {
    return UNKNOWN;
  }

  return {
    edition: raw.edition?.trim().slice(0, MAX_EDITION_LENGTH) || null,
    questions,
    source: { title: raw.sourceTitle?.trim().slice(0, MAX_TITLE_LENGTH) || null, url },
    status: "found",
  };
}
