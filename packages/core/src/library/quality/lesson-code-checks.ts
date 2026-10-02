import { type LessonScreen, type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import {
  WRITTEN_KINDS_BY_SCREEN,
  type WrittenLesson,
  type WrittenScreen,
} from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type CourseLevel } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { safeParseStepContent } from "../steps/contract/step-contract";
import { type ConvertedScreen, toStepContent } from "../steps/written-screens";
import { findArithmeticErrors } from "./_utils/arithmetic";
import { findLessonPhrases } from "./_utils/lesson-phrases";
import { findLongSentences, getMaxExplanationCharacters } from "./_utils/reading-level";
import { type RepeatedExample, findRepeatedExamples } from "./_utils/repeated-examples";
import { findRepeatedQuestions } from "./_utils/repeated-questions";
import { getScreenTexts } from "./_utils/screen-texts";
import { findTermsUsedBeforeExplained } from "./_utils/term-order";

/** A summary idea is one sentence; two short ones are tolerated, a paragraph isn't. */
const MAX_SUMMARY_SENTENCES = 2;
const SENTENCE_END = /[.!?…](?:\s|$)/gu;

type LessonCheckCode =
  | "activityProgram"
  | "activityTemplate"
  | "arithmetic"
  | "duplicateOptions"
  | "filler"
  | "invalidContent"
  | "lessonFraming"
  | "readingLevel"
  | "repeatedExample"
  | "repeatedQuestion"
  | "screenCount"
  | "screenKind"
  | "screenLength"
  | "summary"
  | "termOrder";

/** One reason a lesson can't be published yet. `screen` is a 0-based index, or null for the lesson. */
export type LessonCheckProblem = { code: LessonCheckCode; problem: string; screen: number | null };

type ScreenCheckInput = {
  /** After the fix pass, an activity that couldn't be fixed may become a check. */
  allowActivityFallback: boolean;
  index: number;
  language: string;
  level: CourseLevel;
  screen: WrittenScreen;
  specScreen: LessonScreen;
};

type Problem = { code: LessonCheckCode; problem: string } | false;

function isAllowedKind({ allowActivityFallback, screen, specScreen }: ScreenCheckInput): boolean {
  return (
    WRITTEN_KINDS_BY_SCREEN[specScreen.kind].includes(screen.kind) ||
    (allowActivityFallback && specScreen.kind === "activity" && screen.kind === "check")
  );
}

function getKindProblems(input: ScreenCheckInput): Problem[] {
  const { screen, specScreen } = input;

  return [
    !isAllowedKind(input) && {
      code: "screenKind",
      problem: `Planned as ${specScreen.kind} but written as ${screen.kind}; write it as ${WRITTEN_KINDS_BY_SCREEN[specScreen.kind].join(" or ")}.`,
    },
    screen.kind === "activity" &&
      specScreen.kind === "activity" &&
      screen.template !== specScreen.activityTemplate && {
        code: "activityTemplate",
        problem: `Uses the ${screen.template} template; the plan asks for ${specScreen.activityTemplate}.`,
      },
  ];
}

function hasDuplicateOptions(screen: WrittenScreen): boolean {
  if (screen.kind !== "check" && screen.kind !== "hookGuess") {
    return false;
  }

  const texts = screen.options.map((option) => normalizeString(option.text));
  return new Set(texts).size !== texts.length;
}

function getTextProblems({
  language,
  level,
  screen,
}: Pick<ScreenCheckInput, "language" | "level" | "screen">): Problem[] {
  const texts = getScreenTexts(screen);

  const textProblems = texts.flatMap(({ prose, text }) => {
    const phrases = findLessonPhrases({ language, text });

    return [
      ...phrases.framing.map((phrase) => ({
        code: "lessonFraming" as const,
        problem: `Talks about the lesson itself ("${phrase}"); open with the idea instead.`,
      })),
      ...phrases.filler.map((phrase) => ({
        code: "filler" as const,
        problem: `Uses filler ("${phrase}"); cut it and say the idea directly.`,
      })),
      ...(prose ? findLongSentences({ level, text }) : []).map((sentence) => ({
        code: "readingLevel" as const,
        problem: `This sentence is too long for a ${level} learner; split it: "${sentence}"`,
      })),
      ...findArithmeticErrors({ language, text }).map((error) => ({
        code: "arithmetic" as const,
        problem: `Wrong arithmetic: ${error}`,
      })),
    ];
  });

  const maxCharacters = getMaxExplanationCharacters(level);

  return [
    ...textProblems,
    screen.kind === "explanation" &&
      screen.text.length > maxCharacters && {
        code: "screenLength",
        problem: `The text has ${screen.text.length} characters; one screen holds one idea in under ${maxCharacters}. Cut words or keep only this screen's idea.`,
      },
    hasDuplicateOptions(screen) && {
      code: "duplicateOptions",
      problem: "Two options say the same thing.",
    },
  ];
}

/**
 * The text rules for one screen written on its own, such as a "Simpler"
 * version: no talk about the lesson, no filler, sentences and screens short
 * enough for the level, right arithmetic and distinct options.
 */
export function checkScreenText(input: {
  language: string;
  level: CourseLevel;
  screen: WrittenScreen;
}): string[] {
  return getTextProblems(input).flatMap((problem) => (problem ? [problem.problem] : []));
}

function checkScreen(input: ScreenCheckInput): {
  converted: ConvertedScreen;
  problems: LessonCheckProblem[];
} {
  const converted = toStepContent(input.screen, {
    allowImage: input.specScreen.visual !== null,
    language: input.language,
  });

  const contentProblems: Problem[] = converted.ok
    ? []
    : converted.problems.map((problem) => ({ code: "invalidContent", problem }));

  const problems = [...getKindProblems(input), ...contentProblems, ...getTextProblems(input)]
    .filter((problem) => problem !== false)
    .map((problem) => ({ ...problem, screen: input.index }));

  return { converted, problems };
}

function countSentences(text: string): number {
  return Math.max(1, [...text.matchAll(SENTENCE_END)].length);
}

function getSummaryProblems({
  language,
  summary,
}: {
  language: string;
  summary: readonly string[];
}): LessonCheckProblem[] {
  const parsed = safeParseStepContent("summary", {
    ideas: summary.map((text) => ({ text: text.trim() })),
  });

  const normalized = summary.map((idea) => normalizeString(idea));

  const problems: Problem[] = [
    !parsed.success && {
      code: "summary",
      problem: `The summary card is invalid: ${parsed.error?.issues.map((issue) => issue.message).join("; ")}.`,
    },
    summary.some((idea) => countSentences(idea) > MAX_SUMMARY_SENTENCES) && {
      code: "summary",
      problem: "Each summary idea is one sentence.",
    },
    new Set(normalized).size !== normalized.length && {
      code: "summary",
      problem: "Two summary ideas say the same thing.",
    },
    summary.some((idea) => findLessonPhrases({ language, text: idea }).framing.length > 0) && {
      code: "lessonFraming",
      problem: "The summary talks about the lesson itself; state each idea directly.",
    },
  ];

  return problems
    .filter((problem) => problem !== false)
    .map((problem) => ({ ...problem, screen: null }));
}

/** A term used on a screen before the screen that explains it: explain first, then use it. */
function getTermOrderProblems(lesson: WrittenLesson): LessonCheckProblem[] {
  return findTermsUsedBeforeExplained(lesson.screens).map(({ introducedAt, term, usedAt }) => ({
    code: "termOrder",
    problem: `Uses "${term}" before screen ${introducedAt + 1} explains it. Explain it in everyday words before this screen uses it, or say it here without the term.`,
    screen: usedAt,
  }));
}

function describeRepeat({ numbers, repeats }: RepeatedExample): string {
  const shared = numbers.join(", ");

  return "lesson" in repeats
    ? `Reuses the numbers ${shared} from the earlier lesson "${repeats.lesson}". Use a new case with its own numbers that teaches the same thing, on every screen that uses it.`
    : `The application reuses the numbers ${shared} from screen ${repeats.screen + 1}. Give it a new situation with its own numbers that takes one step further than the checks.`;
}

/** A screen that repeats an earlier lesson's example, or an application that repeats this lesson's. */
function getRepeatProblems(
  input: Parameters<typeof findRepeatedExamples>[0],
): LessonCheckProblem[] {
  return findRepeatedExamples(input).map((repeat) => ({
    code: "repeatedExample",
    problem: describeRepeat(repeat),
    screen: repeat.screen,
  }));
}

/** A check that asks an earlier check's question again with other numbers, names or objects. */
function getRepeatedQuestionProblems(screens: readonly WrittenScreen[]): LessonCheckProblem[] {
  return findRepeatedQuestions(screens).map(({ repeats, screen }) => ({
    code: "repeatedQuestion",
    problem: `Asks the question of screen ${repeats + 1} again with other numbers or names. Keep this screen's idea but ask something new about it: the reverse question, a harder case, a mistake to spot or a decision in a real situation.`,
    screen,
  }));
}

/**
 * The lesson as the reviewer reads it: stored content where a screen
 * converted, so it sees what learners will see, and the written screen where
 * it didn't.
 */
export function toReviewedLesson({
  lesson,
  screens,
}: {
  lesson: WrittenLesson;
  screens: readonly ConvertedScreen[];
}): { screens: { content: unknown; kind: string }[]; summary: string[] } {
  return {
    screens: lesson.screens.map((written, index) => {
      const converted = screens[index];

      return converted?.ok
        ? { content: converted.content, kind: converted.kind }
        : { content: written, kind: written.kind };
    }),
    summary: lesson.summary,
  };
}

/**
 * The code half of the quality gate, run on every written lesson: one screen
 * per planned screen in an allowed kind, content that passes the step contract
 * and the activity validator, calculations recomputed from their data,
 * arithmetic in the text recomputed, no talk about "this lesson", no filler,
 * sentences and screens short enough for the level, no term used before the screen that explains
 * it, distinct options, no example an earlier lesson of the chapter already used (nor an
 * application that repeats one of this lesson's screens), no check that asks an earlier check's
 * question again and a summary card of one sentence per idea. Returns each screen converted to its
 * stored content next to the problems, written for the fix pass.
 */
export function checkWrittenLesson({
  allowActivityFallback = false,
  chapterLessons,
  language,
  lesson,
  level,
  material,
  sources,
  spec,
}: {
  allowActivityFallback?: boolean;
  /** The chapter's other lessons, whose examples this one shouldn't reuse. */
  chapterLessons?: Parameters<typeof findRepeatedExamples>[0]["chapterLessons"];
  language: string;
  lesson: WrittenLesson;
  level: CourseLevel;
  /** The learner's material the lesson is written from: numbers it states are facts, not cases. */
  material?: string;
  /** The official sources the lesson is written from, whose numbers are facts too. */
  sources?: string;
  spec: LessonSpec;
}): { problems: LessonCheckProblem[]; screens: ConvertedScreen[] } {
  const checked = lesson.screens.flatMap((screen, index) => {
    const specScreen = spec.screens[index];

    return specScreen
      ? [checkScreen({ allowActivityFallback, index, language, level, screen, specScreen })]
      : [];
  });

  const countProblem: LessonCheckProblem[] =
    lesson.screens.length === spec.screens.length
      ? []
      : [
          {
            code: "screenCount",
            problem: `Has ${lesson.screens.length} screens; the plan has ${spec.screens.length}, one per planned screen.`,
            screen: null,
          },
        ];

  return {
    problems: [
      ...countProblem,
      ...checked.flatMap((result) => result.problems),
      ...getTermOrderProblems(lesson),
      ...getRepeatProblems({
        chapterLessons,
        documents: [material, sources].filter(Boolean).join("\n"),
        language,
        screens: lesson.screens,
        spec,
      }),
      ...getRepeatedQuestionProblems(lesson.screens),
      ...getSummaryProblems({ language, summary: lesson.summary }),
    ],
    screens: checked.map((result) => result.converted),
  };
}
