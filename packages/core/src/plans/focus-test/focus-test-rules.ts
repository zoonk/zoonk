const FOCUS_TEST_MAX_AREAS = 10;

export const FOCUS_TEST_MIN_AREAS = 2;

const MIN_AREA_QUESTIONS = 3;

const FEW_AREAS = 6;

export const FOCUS_TEST_MAX_QUESTIONS = 30;

const STRONG_MASTERY = 0.75;

const MAX_FOCUS_AREAS = 3;

export type FocusTestArea = {
  label: string;
  name: string;
  skillIds: readonly string[];
  worth: number;
};

export function getQuestionsPerArea(areas: number): number {
  return areas <= FEW_AREAS ? MIN_AREA_QUESTIONS + 1 : MIN_AREA_QUESTIONS;
}

export function pickFocusTestAreas(areas: readonly FocusTestArea[]): FocusTestArea[] {
  const asked = areas
    .filter((area) => area.skillIds.length > 0)
    .map((area, index) => ({ area, index }))
    .toSorted((a, b) => b.area.worth - a.area.worth || a.index - b.index)
    .slice(0, FOCUS_TEST_MAX_AREAS);

  return asked.toSorted((a, b) => a.index - b.index).map((entry) => entry.area);
}

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

export type FocusTestAnswer = { area: string; chance: number; isCorrect: boolean };

export type FocusAreaResult = {
  answers: boolean[];
  correct: number;
  label: string;
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
