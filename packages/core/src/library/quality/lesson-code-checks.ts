import { type LessonScreen, type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import {
  type LessonMap,
  type WrittenLesson,
  type WrittenScreen,
  getWrittenKinds,
} from "@zoonk/ai/tasks/lesson-writer/schema";
import { type CourseLevel } from "@zoonk/db";
import { removeMarkdownTables } from "@zoonk/utils/markdown-table";
import { findOptionPositionReferences } from "../_utils/answer-options";
import { type ConvertedScreen, toStepContent } from "../steps/written-screens";
import { findArithmeticErrors } from "./_utils/arithmetic";
import { getLessonMapProblems } from "./_utils/lesson-map-checks";
import { findLessonPhrases } from "./_utils/lesson-phrases";
import { findLongSentences } from "./_utils/reading-level";
import { type RepeatedExample, findRepeatedExamples } from "./_utils/repeated-examples";
import { findRepeatedQuestions } from "./_utils/repeated-questions";
import { findAnswerFlaws, findTextFlaws } from "./_utils/screen-flaws";
import { findOverweightTexts } from "./_utils/screen-length";
import { getScreenTexts } from "./_utils/screen-texts";
import { canHaveImage, getScreenVisualProblems } from "./_utils/screen-visuals";
import { findTermsUsedBeforeExplained } from "./_utils/term-order";
import { type LessonFlowCheckCode, checkLessonFlow } from "./lesson-flow-checks";

type LessonCheckCode =
  | LessonFlowCheckCode
  | "activityProgram"
  | "activityTemplate"
  | "answerKey"
  | "arithmetic"
  | "duplicateOptions"
  | "filler"
  | "invalidContent"
  | "lessonFraming"
  | "markdown"
  | "optionData"
  | "optionPosition"
  | "placeholder"
  | "readingLevel"
  | "repeatedExample"
  | "repeatedQuestion"
  | "screenCount"
  | "screenKind"
  | "summary"
  | "termOrder"
  | "visual";

export type LessonCheckProblem = { code: LessonCheckCode; problem: string; screen: number | null };

type ScreenCheckInput = {
  allowActivityFallback: boolean;
  index: number;
  language: string;
  level: CourseLevel;
  screen: WrittenScreen;
  specScreen: LessonScreen;
  shortAnswers: boolean;
};

type Problem = { code: LessonCheckCode; problem: string } | false;

function getKindProblems({
  allowActivityFallback,
  screen,
  specScreen,
  shortAnswers,
}: ScreenCheckInput): Problem[] {
  const kinds = getWrittenKinds({ kind: specScreen.kind, shortAnswers });

  const fallback =
    allowActivityFallback && specScreen.kind === "activity" && screen.kind === "check";

  return [
    !kinds.includes(screen.kind) &&
      !fallback && {
        code: "screenKind",
        problem: `Planned as ${specScreen.kind} but written as ${screen.kind}; write it as ${kinds.join(" or ")}.`,
      },
    screen.kind === "activity" &&
      specScreen.kind === "activity" &&
      screen.template !== specScreen.activityTemplate && {
        code: "activityTemplate",
        problem: `Uses the ${screen.template} template; the plan asks for ${specScreen.activityTemplate}.`,
      },
  ];
}

function hasShuffledOptions(screen: WrittenScreen): boolean {
  return screen.kind === "check" || screen.kind === "hookGuess";
}

function getTextProblems({
  language,
  level,
  screen,
}: Pick<ScreenCheckInput, "language" | "level" | "screen">): Problem[] {
  const texts = getScreenTexts(screen);

  const textProblems = texts.flatMap((screenText) => {
    const { prose, text } = screenText;
    const phrases = findLessonPhrases({ language, text });
    const positions = hasShuffledOptions(screen) ? findOptionPositionReferences(text) : [];

    return [
      ...findTextFlaws(screenText),
      ...positions.map((phrase) => ({
        code: "optionPosition" as const,
        problem: `Points at an option by its place ("${phrase}"), but options are shuffled before learners see them; name the option by what it says instead.`,
      })),
      ...phrases.framing.map((phrase) => ({
        code: "lessonFraming" as const,
        problem: `Talks about the lesson itself ("${phrase}"); open with the idea instead.`,
      })),
      ...phrases.filler.map((phrase) => ({
        code: "filler" as const,
        problem: `Uses filler ("${phrase}"); cut it and say the idea directly.`,
      })),
      ...(prose ? findLongSentences({ level, text: removeMarkdownTables(text) }) : []).map(
        (sentence) => ({
          code: "readingLevel" as const,
          problem: `This sentence is too long for a ${level} learner; split it: "${sentence}"`,
        }),
      ),
      ...findArithmeticErrors({ language, text }).map((error) => ({
        code: "arithmetic" as const,
        problem: `Wrong arithmetic: ${error}`,
      })),
    ];
  });

  return [...textProblems, ...findAnswerFlaws({ language, screen })];
}

export function checkScreenText(input: {
  language: string;
  level: CourseLevel;
  screen: WrittenScreen;
}): string[] {
  return getTextProblems(input).flatMap((problem) => (problem ? [problem.problem] : []));
}

function exploresTemplate(converted: ConvertedScreen): boolean {
  return converted.ok && "explore" in converted.content;
}

function checkScreen(input: ScreenCheckInput): {
  converted: ConvertedScreen;
  problems: LessonCheckProblem[];
} {
  const allowImage = canHaveImage(input);
  const converted = toStepContent(input.screen, { allowImage, language: input.language });

  const contentProblems: Problem[] = converted.ok
    ? findOverweightTexts(converted).map((problem) => ({ code: "screenLength", problem }))
    : converted.problems.map((problem) => ({ code: "invalidContent", problem }));

  const problems = [
    ...getKindProblems(input),
    ...contentProblems,
    ...getTextProblems(input),
    ...getScreenVisualProblems({ ...input, allowImage, explores: exploresTemplate(converted) }).map(
      (problem) => ({ code: "visual" as const, problem }),
    ),
  ]
    .filter((problem) => problem !== false)
    .map((problem) => ({ ...problem, screen: input.index }));

  return { converted, problems };
}

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

function getRepeatProblems(
  input: Parameters<typeof findRepeatedExamples>[0],
): LessonCheckProblem[] {
  return findRepeatedExamples(input).map((repeat) => ({
    code: "repeatedExample",
    problem: describeRepeat(repeat),
    screen: repeat.screen,
  }));
}

function getRepeatedQuestionProblems(screens: readonly WrittenScreen[]): LessonCheckProblem[] {
  return findRepeatedQuestions(screens).map(({ repeats, screen }) => ({
    code: "repeatedQuestion",
    problem: `Asks the question of screen ${repeats + 1} again with other numbers or names. Keep this screen's idea but ask something new about it: the reverse question, a harder case, a mistake to spot or a decision in a real situation.`,
    screen,
  }));
}

export function toReviewedLesson({
  lesson,
  screens,
}: {
  lesson: WrittenLesson;
  screens: readonly ConvertedScreen[];
}): { screens: { content: unknown; kind: string }[]; summary: LessonMap } {
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

export function checkWrittenLesson({
  allowActivityFallback = false,
  chapterLessons,
  language,
  lesson,
  level,
  material,
  sources,
  spec,
  shortAnswers = false,
}: {
  allowActivityFallback?: boolean;
  chapterLessons?: Parameters<typeof findRepeatedExamples>[0]["chapterLessons"];
  language: string;
  lesson: WrittenLesson;
  level: CourseLevel;
  material?: string;
  sources?: string;
  spec: LessonSpec;
  shortAnswers?: boolean;
}): { problems: LessonCheckProblem[]; screens: ConvertedScreen[] } {
  const lessonInput = { allowActivityFallback, language, level, shortAnswers };

  const checked = lesson.screens.flatMap((screen, index) => {
    const specScreen = spec.screens[index];
    return specScreen ? [checkScreen({ ...lessonInput, index, screen, specScreen })] : [];
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

  const screens = checked.map((result) => result.converted);

  return {
    problems: [
      ...countProblem,
      ...checked.flatMap((result) => result.problems),
      ...checkLessonFlow({ lesson, screens, spec }),
      ...getTermOrderProblems(lesson),
      ...getRepeatProblems({
        chapterLessons,
        documents: [material, sources].filter(Boolean).join("\n"),
        language,
        screens: lesson.screens,
        spec,
      }),
      ...getRepeatedQuestionProblems(lesson.screens),
      ...getLessonMapProblems({ language, map: lesson.summary }),
    ],
    screens,
  };
}
