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

/**
 * Each subject's questions in the order the subjects were asked (null for one the source gives no
 * single count for), with where they came from.
 */
export type SubjectQuestionsFinding =
  | {
      edition: string | null;
      questions: (number | null)[];
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

/** One count per subject, in their order: null for a subject with none, two, or not a count. */
function toQuestions({
  counts,
  subjectCount,
}: {
  counts: RawSubjectQuestionsFinding["counts"];
  subjectCount: number;
}): (number | null)[] {
  return Array.from({ length: subjectCount }, (_, index) => {
    const [match, ...others] = counts.filter((count) => count.subject === index + 1);
    return match && others.length === 0 && isCount(match.questions) ? match.questions : null;
  });
}

/**
 * Whether the counts fit the exam's total: every subject's adds up to it, and some subjects' never
 * pass it (the source counts a subject the notice's reading doesn't name, as one reading of the
 * OAB's notice dropped ethics and its 8 of 80).
 */
function fitsTotal({ questions, total }: { questions: (number | null)[]; total: number | null }) {
  if (total === null) {
    return true;
  }

  const sum = questions.reduce<number>((all, count) => all + (count ?? 0), 0);
  return questions.includes(null) ? sum <= total : sum === total;
}

/**
 * Keeps only counts a learner can plan by: from a page a search actually returned, one per
 * subject, adding up to the exam's total when the notice gives one and every subject has its
 * count. A subject the source gives no single count for has none, and the others keep theirs;
 * anything else reads as not known, never as a guess.
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
  const counted = questions.some((count) => count !== null && count > 0);

  if (!counted || !url || !URL.canParse(url) || !isSearched(url)) {
    return UNKNOWN;
  }

  if (!fitsTotal({ questions, total })) {
    return UNKNOWN;
  }

  return {
    edition: raw.edition?.trim().slice(0, MAX_EDITION_LENGTH) || null,
    questions,
    source: { title: raw.sourceTitle?.trim().slice(0, MAX_TITLE_LENGTH) || null, url },
    status: "found",
  };
}
