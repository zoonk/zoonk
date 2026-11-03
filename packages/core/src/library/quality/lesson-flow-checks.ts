import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { MAX_SCREEN_CHARACTERS } from "@zoonk/ai/tasks/lesson-writer/screen-length";
import { findQuestionBases } from "../steps/question-bases";
import { type ConvertedScreen } from "../steps/written-screens";
import { findGuessGiveaways } from "./_utils/guess-giveaways";
import { findMixedMoneyFormats } from "./_utils/money-formats";
import { findScreensWithNewTerms } from "./_utils/new-terms";
import {
  type RepeatedVisual,
  findMissingPlannedVisual,
  findRepeatedVisuals,
} from "./_utils/planned-visuals";
import { findLongScreens } from "./_utils/screen-length";

export type LessonFlowCheckCode =
  | "basis"
  | "guessAnswer"
  | "moneyFormat"
  | "newTerms"
  | "plannedVisual"
  | "repeatedVisual"
  | "screenLength";

type LessonFlowProblem = { code: LessonFlowCheckCode; problem: string; screen: number };

function hasBasis(screen: WrittenScreen): screen is Extract<WrittenScreen, { basis: unknown }> {
  return screen.kind === "check" || screen.kind === "mathCheck" || screen.kind === "typedAnswer";
}

/**
 * After a wrong answer the app shows the earlier sentence that decides it, so every check but the
 * application, which may combine several screens, needs one that's really there.
 */
function getBasisProblems({
  lesson,
  screens,
  spec,
}: {
  lesson: WrittenLesson;
  screens: readonly ConvertedScreen[];
  spec: LessonSpec;
}): LessonFlowProblem[] {
  const needsBasis = (index: number) => spec.screens[index]?.kind !== "application";

  const misquoted = findQuestionBases({ lesson, screens }).problems.filter((problem) =>
    needsBasis(problem.screen),
  );

  const missing = lesson.screens.flatMap((screen, index) =>
    hasBasis(screen) && screen.basis === null && needsBasis(index)
      ? [
          {
            problem:
              "Has no basis: no sentence of an earlier screen decides its answer. Ask what an earlier screen taught, or state the deciding fact on the screen that teaches it, and quote that sentence.",
            screen: index,
          },
        ]
      : [],
  );

  return [...misquoted, ...missing].map((problem) => ({ ...problem, code: "basis" as const }));
}

function describeRepeatedVisual({ kind, template }: Omit<RepeatedVisual, "screen">): string {
  if (kind === "template") {
    return `Shows the same ${String(template)} as the screen before. Ask about something the learner works out with it, or show this screen's idea another way.`;
  }

  if (kind === "columns") {
    return "Shows a table with the same columns as the screen before. Show this screen's idea another way (a chart, a template to explore, a picture of the story's object), or a table that compares something else.";
  }

  return "Shows the same table as the screen before. Change it to show this screen's idea (a new row, a value that moved) or show the idea another way.";
}

function getVisualProblems({
  lesson,
  screens,
  spec,
}: {
  lesson: WrittenLesson;
  screens: readonly ConvertedScreen[];
  spec: LessonSpec;
}): LessonFlowProblem[] {
  const missing = lesson.screens.flatMap((screen, index) => {
    const specScreen = spec.screens[index];
    const converted = screens[index];
    const explores = converted?.ok === true && "explore" in converted.content;
    const problem = specScreen ? findMissingPlannedVisual({ explores, screen, specScreen }) : null;

    return problem ? [{ code: "plannedVisual" as const, problem, screen: index }] : [];
  });

  const repeated = findRepeatedVisuals(lesson.screens).map(({ kind, screen, template }) => ({
    code: "repeatedVisual" as const,
    problem: describeRepeatedVisual({ kind, template }),
    screen,
  }));

  return [...missing, ...repeated];
}

function getWordingProblems({ lesson }: { lesson: WrittenLesson }): LessonFlowProblem[] {
  const long = findLongScreens(lesson.screens).map(({ characters, part, screen }) => ({
    code: "screenLength" as const,
    problem: `${part ? `Its ${part} has` : "Has"} ${characters} characters to read besides its tables; a screen holds one idea in a tweet, at most ${MAX_SCREEN_CHARACTERS}. Keep that idea and its example, put detail in the screen's table or visual, and cut the rest.`,
    screen,
  }));

  const guesses = findGuessGiveaways(lesson.screens).map((giveaway) => ({
    ...giveaway,
    code: "guessAnswer" as const,
  }));

  const bold = findScreensWithNewTerms(lesson.screens).map(({ screen, terms }) => ({
    code: "newTerms" as const,
    problem: `Explains ${terms.length} new terms in bold (${terms.join(", ")}); a screen explains one. Move the others to their own screens or say them in plain words.`,
    screen,
  }));

  const money = findMixedMoneyFormats(lesson.screens).map(({ first, mention }) => ({
    code: "moneyFormat" as const,
    problem: `Writes money as "${mention.text}" while screen ${first.screen + 1} writes "${first.text}". Write a currency one way on every screen: the same mark, and cents on every amount or on none.`,
    screen: mention.screen,
  }));

  return [...guesses, ...bold, ...money, ...long];
}

export function checkLessonFlow(input: {
  lesson: WrittenLesson;
  screens: readonly ConvertedScreen[];
  spec: LessonSpec;
}): LessonFlowProblem[] {
  return [...getVisualProblems(input), ...getBasisProblems(input), ...getWordingProblems(input)];
}
