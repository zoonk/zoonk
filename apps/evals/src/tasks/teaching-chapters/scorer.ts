import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";

/**
 * Per skill key: the chapters that may teach it (null when a new chapter is right too) and, when
 * its place matters, the chapters a new one may follow.
 */
export type TeachingChaptersExpected = Record<
  string,
  { after?: number[]; chapters: (number | null)[] }
>;

type Answer = { after: number | null; chapter: number | null };

const MIN_SCORE = 6;
const MAX_SCORE = 10;

function parseAnswers(output: string): Map<string, Answer> {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!Array.isArray(parsed)) {
      return new Map();
    }

    return new Map(
      parsed.flatMap((answer) =>
        isJsonObject(answer) && typeof answer.key === "string"
          ? [
              [
                answer.key,
                {
                  after: typeof answer.after === "number" ? answer.after : null,
                  chapter: typeof answer.chapter === "number" ? answer.chapter : null,
                },
              ] as const,
            ]
          : [],
      ),
    );
  } catch {
    return new Map();
  }
}

function describeChapter(chapter: number | null | undefined): string {
  return chapter === null || chapter === undefined ? "a new chapter" : `chapter ${chapter}`;
}

export const scoreTeachingChapters: TaskScorer<TeachingChaptersExpected> = ({
  output,
  testCase,
}) => {
  const expected = Object.entries(testCase.expected ?? {});
  const answers = parseAnswers(output);

  const misses = expected.flatMap(([key, { after, chapters }]) => {
    const answer = answers.get(key);
    const chapter = answer?.chapter;

    if (answer === undefined || !chapters.includes(answer.chapter)) {
      return [
        `${key}: expected ${chapters.map((item) => describeChapter(item)).join(" or ")}, got ${describeChapter(chapter)}`,
      ];
    }

    return chapter === null && after && !after.includes(answer.after ?? -1)
      ? [`${key}: expected a new chapter after ${after.join(" or ")}, got after ${answer.after}`]
      : [];
  });

  const right = expected.length - misses.length;
  const score = MIN_SCORE + ((MAX_SCORE - MIN_SCORE) * right) / Math.max(expected.length, 1);
  const conclusion = misses.length === 0 ? "None" : `${misses.join("; ")}.`;

  return createFixedScore({ conclusion, score: Math.round(score * 10) / 10 });
};
