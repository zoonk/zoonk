/**
 * The focus test: a few questions on each of the plan's areas worth most, in the exam's format,
 * so a learner whose time doesn't cover everything in depth can let their answers say where the
 * depth goes. Its rules are pure: which areas, how many questions on each, how each area scores
 * and which areas get the focus.
 */

/**
 * The most areas a test asks about: the ones worth most, so it stays around a quarter of an hour
 * even for a notice of many subjects (a concurso's nine or ten).
 */
const FOCUS_TEST_MAX_AREAS = 10;

/** Choosing a focus needs at least two areas to choose between. */
export const FOCUS_TEST_MIN_AREAS = 2;

/** Never fewer questions on an area: one or two answers never decide it. */
const MIN_AREA_QUESTIONS = 3;

/** Four questions on each area when there are few, three when there are many. */
const FEW_AREAS = 6;

/** The most questions a test asks: ten areas of three, or six of four. */
export const FOCUS_TEST_MAX_QUESTIONS = 30;

/** A known area: its guess-corrected share right is this high, so it needs no extra depth. */
const STRONG_MASTERY = 0.75;

/** At most this many areas get the focus, and never more than a third of the ones tested. */
const MAX_FOCUS_AREAS = 3;

/**
 * An area of the plan (`name`, as plan changes take it), what learners call it (`label`: an exam
 * subject's short name), its worth to the goal (its share of the exam) and its skills in order.
 */
export type FocusTestArea = {
  label: string;
  name: string;
  skillIds: readonly string[];
  worth: number;
};

/** How many questions each area gets: four when there are few areas, three when there are many. */
export function getQuestionsPerArea(areas: number): number {
  return areas <= FEW_AREAS ? MIN_AREA_QUESTIONS + 1 : MIN_AREA_QUESTIONS;
}

/**
 * The areas the test asks about: the ones worth most, up to `FOCUS_TEST_MAX_AREAS`, in the plan's
 * own order. Areas without skills aren't asked.
 */
export function pickFocusTestAreas(areas: readonly FocusTestArea[]): FocusTestArea[] {
  const asked = areas
    .filter((area) => area.skillIds.length > 0)
    .map((area, index) => ({ area, index }))
    .toSorted((a, b) => b.area.worth - a.area.worth || a.index - b.index)
    .slice(0, FOCUS_TEST_MAX_AREAS);

  return asked.toSorted((a, b) => a.index - b.index).map((entry) => entry.area);
}

/**
 * The skill each of an area's questions asks about, spread over the area: evenly spaced skills
 * when it has more than questions, and a skill asked more than once when it has fewer.
 */
export function spreadAreaQuestions({
  count,
  skillIds,
}: {
  count: number;
  skillIds: readonly string[];
}): string[] {
  return Array.from(
    { length: count },
    (_, index) => skillIds[Math.floor((index * skillIds.length) / count)] ?? "",
  ).filter(Boolean);
}

/** One graded answer: its area, whether it was right, and the chance of guessing it right. */
export type FocusTestAnswer = { area: string; chance: number; isCorrect: boolean };

export type FocusAreaResult = {
  /** Each answer in the order asked: right or not. */
  answers: boolean[];
  correct: number;
  label: string;
  /** The share right once lucky guesses are taken out (true or false is a coin flip), 0 to 1. */
  mastery: number;
  name: string;
  total: number;
  worth: number;
};

function getMastery(answers: readonly FocusTestAnswer[]): number {
  const right = answers.filter((answer) => answer.isCorrect).length / answers.length;
  const chance = answers.reduce((sum, answer) => sum + answer.chance, 0) / answers.length;

  return chance >= 1 ? right : Math.min(1, Math.max(0, (right - chance) / (1 - chance)));
}

/**
 * Each tested area's result, from at least three answers on it: one or two answers never decide
 * an area, so an area with fewer isn't scored.
 */
export function scoreFocusTest({
  answers,
  areas,
}: {
  answers: readonly FocusTestAnswer[];
  areas: readonly Pick<FocusTestArea, "label" | "name" | "worth">[];
}): FocusAreaResult[] {
  return areas.flatMap((area) => {
    const own = answers.filter((answer) => answer.area === area.name);

    if (own.length < MIN_AREA_QUESTIONS) {
      return [];
    }

    return [
      {
        answers: own.map((answer) => answer.isCorrect),
        correct: own.filter((answer) => answer.isCorrect).length,
        label: area.label,
        mastery: getMastery(own),
        name: area.name,
        total: own.length,
        worth: area.worth,
      },
    ];
  });
}

/**
 * The areas that get the focus: the ones where depth pays most, worth to the goal times what the
 * learner still misses there, leaving out the ones they already know. Up to three, never more
 * than a third of the areas tested, at least one. When they know every area, the one worth most.
 */
export function chooseFocusAreas(results: readonly FocusAreaResult[]): string[] {
  const count = Math.min(MAX_FOCUS_AREAS, Math.max(1, Math.floor(results.length / 3)));

  const ranked = results
    .map((result, index) => ({ index, need: result.worth * (1 - result.mastery), result }))
    .toSorted((a, b) => b.need - a.need || b.result.worth - a.result.worth || a.index - b.index);

  const weak = ranked.filter((entry) => entry.result.mastery < STRONG_MASTERY);

  if (weak.length > 0) {
    return weak.slice(0, count).map((entry) => entry.result.name);
  }

  const [worthMost] = results.toSorted((a, b) => b.worth - a.worth);
  return worthMost ? [worthMost.name] : [];
}
