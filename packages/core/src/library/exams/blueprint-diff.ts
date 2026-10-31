import { normalizeString } from "@zoonk/utils/string";
import { type BlueprintContent, type ExamEdition, type ExamStructure } from "./blueprint-contract";
import { keepKnownSubjectFacts } from "./blueprint-subject-merge";
import { countsEverySubject } from "./subject-questions";
import { toTopicKey } from "./topic-key";

export type BlueprintChange = { after: unknown; before: unknown; field: string };

export type BlueprintMerge = { changes: BlueprintChange[]; content: BlueprintContent };

type Section = { after: unknown; before: unknown; field: string; isEmpty: boolean };

const RESTATING_KEYS = new Set(["citation", "citations", "translations"]);

function withoutRestatements(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => withoutRestatements(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !RESTATING_KEYS.has(key))
        .toSorted(([first], [second]) => first.localeCompare(second))
        .map(([key, item]) => [key, withoutRestatements(item)]),
    );
  }

  return value;
}

function isSame(first: unknown, second: unknown): boolean {
  return JSON.stringify(withoutRestatements(first)) === JSON.stringify(withoutRestatements(second));
}

type ExamRule = ExamStructure["rules"][number];

function keepRulesWithTranslations({
  current,
  next,
}: {
  current: ExamRule[];
  next: ExamRule[];
}): ExamRule[] {
  const translated = new Map(
    next.flatMap((rule) => (rule.translations ? [[rule.text, rule.translations] as const] : [])),
  );

  if (!current.some((rule) => translated.has(rule.text))) {
    return current;
  }

  return current.map((rule) => {
    const translations = translated.get(rule.text);
    return translations ? { ...rule, translations } : rule;
  });
}

function isEmptyValue(value: unknown): boolean {
  return value === null || (Array.isArray(value) && value.length === 0);
}

type ExamFormat = ExamStructure["formats"][number];

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
    check: next.check,
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
    sourceIds: next.sourceIds ?? current.sourceIds,
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

function keepPastQuestions({
  current,
  next,
  subjectsChanged,
}: {
  current: ExamStructure;
  next: ExamStructure;
  subjectsChanged: boolean;
}): ExamStructure["pastQuestions"] {
  const past = current.pastQuestions;

  return past && subjectsChanged && !countsEverySubject({ past, subjects: next.subjects })
    ? undefined
    : past;
}

type Subject = ExamStructure["subjects"][number];

function toSyllabusKey(subject: Subject): string {
  return [...new Set(subject.topics.map((topic) => toTopicKey(topic)))].toSorted().join("\n");
}

/** Past papers ranked and counted a subject's topics as they stood, so new topics need them again. */
function listChangedSyllabi({
  current,
  merged,
}: {
  current: readonly Subject[];
  merged: readonly Subject[];
}): Set<string> {
  const after = new Map(
    merged.map((subject) => [normalizeString(subject.name), toSyllabusKey(subject)]),
  );

  return new Set(
    current
      .filter((subject) => after.get(normalizeString(subject.name)) !== toSyllabusKey(subject))
      .map((subject) => normalizeString(subject.name)),
  );
}

function withLookups({
  current,
  merged,
  next,
  subjectsChanged,
}: {
  current: ExamStructure;
  merged: readonly Subject[];
  next: ExamStructure;
  subjectsChanged: boolean;
}) {
  const changed = listChangedSyllabi({ current: current.subjects, merged });
  const hasNewSyllabus = (name: string) => changed.has(normalizeString(name));

  const stored = keepPastQuestions({ current, next, subjectsChanged });

  const counted = stored?.subjects.some((subject) => hasNewSyllabus(subject.name))
    ? undefined
    : stored;

  const frequency = current.pastTopicFrequency;
  const ranked = frequency?.subjects.filter((subject) => !hasNewSyllabus(subject.name)) ?? [];

  const kept =
    frequency && ranked.length < frequency.subjects.length
      ? { checkedAt: null, subjects: ranked }
      : frequency;

  const pastOptions = current.pastOptions ?? next.pastOptions;
  const pastQuestions = counted ?? next.pastQuestions;
  const pastTopicFrequency = kept ?? next.pastTopicFrequency;

  return {
    ...(pastOptions ? { pastOptions } : {}),
    ...(pastQuestions ? { pastQuestions } : {}),
    ...(pastTopicFrequency ? { pastTopicFrequency } : {}),
  };
}

function listExamDays(edition: ExamEdition): string {
  return edition.dates
    .flatMap((date) => (date.kind === "exam" ? [date.date] : []))
    .toSorted()
    .join(",");
}

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
 * A re-read of the same edition only fills in what it missed; a later edition's notice replaces the
 * last one's subjects and formats (`nextEdition`).
 */
export function mergeBlueprintContent({
  current,
  next: reading,
  nextEdition = false,
}: {
  current: BlueprintContent;
  next: BlueprintContent;
  nextEdition?: boolean;
}): BlueprintMerge {
  const next: BlueprintContent = nextEdition
    ? reading
    : {
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
      after: withoutRestatements(after),
      before: withoutRestatements(before),
      field,
    }));

  const changedFields = new Set(changes.map((change) => change.field));
  const has = (field: string) => changedFields.has(field);

  const subjects = pick({
    changed: has("subjects"),
    current: current.structure.subjects,
    next: next.structure.subjects,
  });

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
          merged: subjects,
          next: next.structure,
          subjectsChanged: has("subjects"),
        }),
        rules: has("rules")
          ? next.structure.rules
          : keepRulesWithTranslations({
              current: current.structure.rules,
              next: next.structure.rules,
            }),
        subjects,
        testedLanguage: next.structure.testedLanguage ?? current.structure.testedLanguage ?? null,
      },
      topicFrequency: pick({
        changed: has("topicFrequency"),
        current: current.topicFrequency,
        next: next.topicFrequency,
      }),
    },
  };
}
