import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { findQuestionBases } from "../steps/question-bases";
import { type ConvertedScreen } from "../steps/written-screens";
import { findWordyExplanations } from "./_utils/explanation-words";
import { findGuessGiveaways } from "./_utils/guess-giveaways";
import { findMixedMoneyFormats } from "./_utils/money-formats";
import { findScreensWithNewTerms } from "./_utils/new-terms";
import { findMissingPlannedVisual, findRepeatedVisuals } from "./_utils/planned-visuals";

export type LessonFlowCheckCode =
  | "basis"
  | "guessAnswer"
  | "moneyFormat"
  | "newTerms"
  | "plannedVisual"
  | "repeatedVisual"
  | "screenWords";

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

  const repeated = findRepeatedVisuals(lesson.screens).map(({ screen, template }) => ({
    code: "repeatedVisual" as const,
    problem: template
      ? `Shows the same ${template} as the screen before. Ask about something the learner works out with it, or show this screen's idea another way.`
      : "Shows the same table as the screen before. Change it to show this screen's idea (a new row, a value that moved) or show the idea another way.",
    screen,
  }));

  return [...missing, ...repeated];
}

function getWordingProblems({
  lesson,
  novice,
}: {
  lesson: WrittenLesson;
  novice: boolean;
}): LessonFlowProblem[] {
  const wordy = findWordyExplanations({ novice, screens: lesson.screens }).map(
    ({ screen, target, words }) => ({
      code: "screenWords" as const,
      problem: `Has ${words} words besides its tables; an explanation here aims for about ${target}. Keep the story's beat, the idea and one example, and cut the rest or leave it to the screen that teaches it.`,
      screen,
    }),
  );

  const guesses = findGuessGiveaways(lesson.screens).map((giveaway) => ({
    ...giveaway,
    code: "guessAnswer" as const,
  }));

  const bold = findScreensWithNewTerms(lesson.screens).map(({ screen, terms }) => ({
    code: "newTerms" as const,
    problem: `Explains ${terms.length} new terms in bold (${terms.join(", ")}); a screen explains one. Move the others to their own screens or say them in plain words.`,
    screen,
  }));

  const [first, ...others] = findMixedMoneyFormats(lesson.screens);

  const money = others.map((mention) => ({
    code: "moneyFormat" as const,
    problem: `Writes money as "${mention.text}" while screen ${(first?.screen ?? 0) + 1} writes "${first?.text ?? ""}". Use one format on every screen: the same currency mark, and cents on every amount or on none.`,
    screen: mention.screen,
  }));

  return [...guesses, ...bold, ...money, ...wordy];
}

/** How the lesson's screens work together: their visuals, the guess, the checks' bases and wording. */
export function checkLessonFlow(input: {
  lesson: WrittenLesson;
  /** `readsNoviceRules` for the lesson, which sets its words per explanation. */
  novice: boolean;
  screens: readonly ConvertedScreen[];
  spec: LessonSpec;
}): LessonFlowProblem[] {
  return [...getVisualProblems(input), ...getBasisProblems(input), ...getWordingProblems(input)];
}
