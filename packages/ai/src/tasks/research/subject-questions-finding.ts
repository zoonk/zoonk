const MAX_TITLE_LENGTH = 200;
const MAX_EDITION_LENGTH = 80;

/** Counts by the subject's number in `SUBJECTS`. */
export type RawSubjectQuestionsFinding = {
  counts: { questions: number; subject: number }[];
  edition: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  status: "found" | "unknown";
};

/** Null for a subject the source gives no single count for. */
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

/** Null for a subject with none, two, or not a count. */
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
 * Some subjects' counts may fall short of the total: the source can count a subject the reading
 * missed (one reading of the OAB's notice dropped ethics and its 8 of 80).
 */
function fitsTotal({ questions, total }: { questions: (number | null)[]; total: number | null }) {
  if (total === null) {
    return true;
  }

  const sum = questions.reduce<number>((all, count) => all + (count ?? 0), 0);
  return questions.includes(null) ? sum <= total : sum === total;
}

/**
 * A subject without a single count has none and the others keep theirs; anything else is unknown.
 */
export function toSubjectQuestionsFinding({
  isSearched,
  raw,
  subjectCount,
  total,
}: {
  /** An address on a site the search didn't return was invented. */
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
