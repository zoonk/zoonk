import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";
import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { readNumbers } from "./arithmetic";
import { getScreenTexts } from "./screen-texts";

type ChapterLesson = NonNullable<WriteLessonDraftParams["chapterLessons"]>[number];

const MIN_SHARED_NUMBERS = 2;
const MIN_SHARED_PART = 0.5;
const MAX_COMMON_COUNT = 10;
const PERCENT_BASE = 100;
const FIRST_YEAR = 1000;
const LAST_YEAR = 2100;

export type RepeatedExample = {
  numbers: number[];
  repeats: { lesson: string } | { screen: number };
  screen: number;
};

function isCaseNumber(value: number): boolean {
  const isYear = Number.isInteger(value) && value >= FIRST_YEAR && value <= LAST_YEAR;
  return Math.abs(value) > MAX_COMMON_COUNT && value !== PERCENT_BASE && !isYear;
}

function toCaseNumbers(values: readonly number[], facts: ReadonlySet<number>): Set<number> {
  return new Set(values.filter((value) => isCaseNumber(value) && !facts.has(value)));
}

function getScreenNumbers({
  facts,
  language,
  screen,
}: {
  facts: ReadonlySet<number>;
  language: string;
  screen: WrittenScreen;
}): Set<number> {
  const stated = getScreenTexts(screen).flatMap(({ text }) => readNumbers({ language, text }));

  const variables =
    screen.kind === "mathCheck" ? screen.math.variables.map((item) => item.value) : [];

  return toCaseNumbers([...stated, ...variables], facts);
}

function getSharedNumbers(first: ReadonlySet<number>, second: ReadonlySet<number>): number[] {
  const shared = [...first].filter((value) => second.has(value));
  const larger = Math.max(first.size, second.size);

  return shared.length >= MIN_SHARED_NUMBERS && shared.length >= larger * MIN_SHARED_PART
    ? shared
    : [];
}

function findFirstShared<TSource>(
  numbers: ReadonlySet<number>,
  sources: readonly { numbers: ReadonlySet<number>; source: TSource }[],
): { numbers: number[]; source: TSource } | null {
  const found = sources
    .map((entry) => ({ numbers: getSharedNumbers(numbers, entry.numbers), source: entry.source }))
    .find((entry) => entry.numbers.length > 0);

  return found ?? null;
}

export function findRepeatedExamples({
  chapterLessons = [],
  documents = "",
  language,
  screens,
  spec,
}: {
  chapterLessons?: readonly ChapterLesson[];
  documents?: string;
  language: string;
  screens: readonly WrittenScreen[];
  spec: LessonSpec;
}): RepeatedExample[] {
  const facts = new Set(readNumbers({ language, text: documents }));
  const screenNumbers = screens.map((screen) => getScreenNumbers({ facts, language, screen }));

  const earlierCases = chapterLessons
    .filter((lesson) => lesson.order === "before")
    .flatMap((lesson) =>
      [...(lesson.ideas ?? []), ...(lesson.examples ?? [])].map((text) => ({
        numbers: toCaseNumbers(readNumbers({ language, text }), facts),
        source: { lesson: lesson.title },
      })),
    );

  const fromLessons = screenNumbers.flatMap((numbers, screen) => {
    const found = findFirstShared(numbers, earlierCases);
    return found ? [{ numbers: found.numbers, repeats: found.source, screen }] : [];
  });

  const application = spec.screens.findIndex((screen) => screen.kind === "application");
  const applicationNumbers = screenNumbers[application];

  const earlierScreens = screenNumbers
    .slice(0, Math.max(application, 0))
    .map((numbers, screen) => ({ numbers, source: { screen } }));

  const fromScreens = applicationNumbers
    ? findFirstShared(applicationNumbers, earlierScreens)
    : null;

  return [
    ...fromLessons,
    ...(fromScreens
      ? [{ numbers: fromScreens.numbers, repeats: fromScreens.source, screen: application }]
      : []),
  ];
}
