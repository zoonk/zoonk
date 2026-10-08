import { type BlueprintContent, type ExamEdition, type ExamStructure } from "./blueprint-contract";
import { keepKnownSubjectFacts } from "./blueprint-subject-merge";

export type BlueprintChange = { after: unknown; before: unknown; field: string };

export type BlueprintMerge = { changes: BlueprintChange[]; content: BlueprintContent };

type Section = { after: unknown; before: unknown; field: string; isEmpty: boolean };

/** Citations say where a fact came from; a new passage for the same fact isn't a change. */
function withoutCitations(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => withoutCitations(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "citation" && key !== "citations")
        .toSorted(([first], [second]) => first.localeCompare(second))
        .map(([key, item]) => [key, withoutCitations(item)]),
    );
  }

  return value;
}

/** Key order differs between parsed output and stored JSON, so values are compared sorted. */
function isSame(first: unknown, second: unknown): boolean {
  return JSON.stringify(withoutCitations(first)) === JSON.stringify(withoutCitations(second));
}

function isEmptyValue(value: unknown): boolean {
  return value === null || (Array.isArray(value) && value.length === 0);
}

type ExamFormat = ExamStructure["formats"][number];

/**
 * A new reading's formats, where one that doesn't state its number of options (a notice that says
 * "180 questões objetivas" without "cinco alternativas") is the stored format of the same kind that
 * does, with the passage that states it: a reading that leaves the count out hasn't changed it,
 * and items are written and picked by it (ENEM's five options).
 */
function keepKnownOptions({
  current,
  next,
}: {
  current: readonly ExamFormat[];
  next: readonly ExamFormat[];
}): ExamFormat[] {
  return next.map((format) => {
    const known = current.find((stored) => stored.kind === format.kind && stored.options !== null);
    return format.options === null && known ? known : format;
  });
}

function getSections({
  current,
  next,
}: {
  current: BlueprintContent;
  next: BlueprintContent;
}): Section[] {
  const pairs: [string, unknown, unknown][] = [
    ["subjects", current.structure.subjects, next.structure.subjects],
    ["formats", current.structure.formats, next.structure.formats],
    ["rules", current.structure.rules, next.structure.rules],
    ["mock", current.structure.mock, next.structure.mock],
    ["edition.year", current.edition.year, next.edition.year],
    ["edition.questionCount", current.edition.questionCount, next.edition.questionCount],
    ["edition.noticeUrl", current.edition.noticeUrl, next.edition.noticeUrl],
    ["edition.dates", current.edition.dates, next.edition.dates],
    ["topicFrequency", current.topicFrequency, next.topicFrequency],
  ];

  return pairs.map(([field, before, after]) => ({
    after,
    before,
    field,
    isEmpty: isEmptyValue(after),
  }));
}

/**
 * A section changes only when the new documents say something different. An
 * empty or missing section in the new reading keeps the old one: a notice that
 * doesn't repeat the syllabus hasn't removed it, and an uncertain extraction
 * must never delete what learners study.
 */
function isChanged(section: Section): boolean {
  return !section.isEmpty && !isSame(section.before, section.after);
}

function pick<T>({ changed, current, next }: { changed: boolean; current: T; next: T }): T {
  return changed ? next : current;
}

function mergeEdition({
  changedFields,
  current,
  next,
}: {
  changedFields: Set<string>;
  current: ExamEdition;
  next: ExamEdition;
}): ExamEdition {
  const hasNewCount =
    changedFields.has("edition.year") || changedFields.has("edition.questionCount");

  return {
    citations: hasNewCount ? next.citations : current.citations,
    dates: pick({
      changed: changedFields.has("edition.dates"),
      current: current.dates,
      next: next.dates,
    }),
    noticeUrl: pick({
      changed: changedFields.has("edition.noticeUrl"),
      current: current.noticeUrl,
      next: next.noticeUrl,
    }),
    questionCount: pick({
      changed: changedFields.has("edition.questionCount"),
      current: current.questionCount,
      next: next.questionCount,
    }),
    sourceHash: next.sourceHash ?? current.sourceHash,
    // The time zone says how to read the dates' start times, so it follows whichever dates stay.
    timeZone: changedFields.has("edition.dates")
      ? (next.timeZone ?? current.timeZone)
      : (current.timeZone ?? next.timeZone),
    year: pick({
      changed: changedFields.has("edition.year"),
      current: current.year,
      next: next.year,
    }),
  };
}

/**
 * The subjects' counts the lookup gave, kept across readings, except a lookup that found none
 * while the reading changes the subjects: it was asked for other subjects (a reading that missed
 * the OAB's Ética left 79 of 80 questions to match), so research asks again for the new ones
 * instead of waiting a month.
 */
function keepPastQuestions({
  current,
  subjectsChanged,
}: {
  current: ExamStructure;
  subjectsChanged: boolean;
}): ExamStructure["pastQuestions"] {
  const past = current.pastQuestions;
  return past && subjectsChanged && past.subjects.length === 0 ? undefined : past;
}

/**
 * The lookups beside the notice's reading (the subjects' counts, the options per question, how
 * often each topic is asked), which a reading never sets: kept across readings, when there are any
 * to keep.
 */
function withLookups({
  current,
  next,
  subjectsChanged,
}: {
  current: ExamStructure;
  next: ExamStructure;
  subjectsChanged: boolean;
}) {
  const pastOptions = current.pastOptions ?? next.pastOptions;
  const pastQuestions = keepPastQuestions({ current, subjectsChanged }) ?? next.pastQuestions;
  const pastTopicFrequency = current.pastTopicFrequency ?? next.pastTopicFrequency;

  return {
    ...(pastOptions ? { pastOptions } : {}),
    ...(pastQuestions ? { pastQuestions } : {}),
    ...(pastTopicFrequency ? { pastTopicFrequency } : {}),
  };
}

/** The exam's own days, in order: what learners' dates follow, unlike registration days or times. */
function listExamDays(edition: ExamEdition): string {
  return edition.dates
    .flatMap((date) => (date.kind === "exam" ? [date.date] : []))
    .toSorted()
    .join(",");
}

/**
 * Whether a merged reading moves the exam's own days: the one change of dates a learner's date
 * follows. A reading that adds registration days, start times or labels moves nothing.
 */
export function movesExamDays({
  current,
  merged,
}: {
  current: BlueprintContent;
  merged: BlueprintContent;
}): boolean {
  return listExamDays(current.edition) !== listExamDays(merged.edition);
}

/**
 * Compares a blueprint with a new reading of its documents and keeps
 * everything that didn't change, so lessons and items built on it carry over,
 * including a number of options the new reading leaves out (`keepKnownOptions`)
 * and what it leaves out of a subject it reads again (`keepKnownSubjectFacts`).
 * The changes list what a learner-facing notice describes.
 */
export function mergeBlueprintContent({
  current,
  next: reading,
}: {
  current: BlueprintContent;
  next: BlueprintContent;
}): BlueprintMerge {
  const next: BlueprintContent = {
    ...reading,
    structure: {
      ...reading.structure,
      formats: keepKnownOptions({
        current: current.structure.formats,
        next: reading.structure.formats,
      }),
      subjects: keepKnownSubjectFacts({
        current: current.structure.subjects,
        next: reading.structure.subjects,
      }),
    },
  };

  const changes = getSections({ current, next })
    .filter((section) => isChanged(section))
    .map(({ after, before, field }) => ({
      after: withoutCitations(after),
      before: withoutCitations(before),
      field,
    }));

  const changedFields = new Set(changes.map((change) => change.field));
  const has = (field: string) => changedFields.has(field);

  return {
    changes,
    content: {
      edition: mergeEdition({ changedFields, current: current.edition, next: next.edition }),
      structure: {
        formats: pick({
          changed: has("formats"),
          current: current.structure.formats,
          next: next.structure.formats,
        }),
        mock: pick({
          changed: has("mock"),
          current: current.structure.mock,
          next: next.structure.mock,
        }),
        ...withLookups({
          current: current.structure,
          next: next.structure,
          subjectsChanged: has("subjects"),
        }),
        rules: pick({
          changed: has("rules"),
          current: current.structure.rules,
          next: next.structure.rules,
        }),
        subjects: pick({
          changed: has("subjects"),
          current: current.structure.subjects,
          next: next.structure.subjects,
        }),
      },
      topicFrequency: pick({
        changed: has("topicFrequency"),
        current: current.topicFrequency,
        next: next.topicFrequency,
      }),
    },
  };
}
