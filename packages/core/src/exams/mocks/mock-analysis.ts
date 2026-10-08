import { type IrtItem, estimateAbility, getIrtCoherence, toScaleRange } from "../scoring/irt";
import { type NetOutcome, getNetCalibration, getNetScore } from "../scoring/net-score";
import { type MockConditions, type MockResult, type MockScoring } from "./mock-contract";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const PERCENT = 100;

/** One asked question after grading, with where it sat and how long it took. */
export type GradedMockAnswer = {
  area: string | null;
  durationMs: number;
  flagged: boolean;
  irtItem: IrtItem;
  outcome: NetOutcome;
  section: number;
  /** The skill it asks, by id and name: the mock's topics. */
  skill: { id: string; name: string };
  /** Left blank without ever being answered in a section that ran out of time. */
  timedOut: boolean;
};

type AreaGroup = { answers: GradedMockAnswer[]; name: string };

function groupByArea({
  answers,
  conditions,
}: {
  answers: readonly GradedMockAnswer[];
  conditions: MockConditions;
}): AreaGroup[] {
  const nameOf = (answer: GradedMockAnswer) =>
    answer.area ?? conditions.sections[answer.section]?.name ?? "";

  const names = [...new Set(answers.map((answer) => nameOf(answer)))];
  return names.map((name) => ({ answers: answers.filter((item) => nameOf(item) === name), name }));
}

/** The exam's pace for a section: its minutes over its questions. */
function getTargetSeconds({
  conditions,
  sections,
}: {
  conditions: MockConditions;
  sections: readonly number[];
}): number | null {
  const paces = [...new Set(sections)].flatMap((index) => {
    const section = conditions.sections[index];

    return section && section.questions > 0
      ? [(section.minutes * SECONDS_PER_MINUTE) / section.questions]
      : [];
  });

  return paces.length > 0 ? paces.reduce((sum, pace) => sum + pace, 0) / paces.length : null;
}

function toResponses(answers: readonly GradedMockAnswer[]) {
  return answers.map((answer) => ({ correct: answer.outcome === "right", item: answer.irtItem }));
}

function averageSeconds(answers: readonly GradedMockAnswer[]): number {
  const total = answers.reduce((sum, answer) => sum + answer.durationMs, 0);
  return answers.length > 0 ? Math.round(total / answers.length / MS_PER_SECOND) : 0;
}

function toAreaResult({
  conditions,
  group,
  scoring,
}: {
  conditions: MockConditions;
  group: AreaGroup;
  scoring: MockScoring;
}): MockResult["areas"][number] {
  const { answers, name } = group;

  return {
    correct: answers.filter((answer) => answer.outcome === "right").length,
    name,
    score: scoring === "irt" ? toScaleRange(estimateAbility(toResponses(answers))) : null,
    secondsPerQuestion: averageSeconds(answers),
    targetSecondsPerQuestion: getTargetSeconds({
      conditions,
      sections: answers.map((answer) => answer.section),
    }),
    total: answers.length,
  };
}

/**
 * ENEM reports one score per area; the mock's overall score is their average, and its range
 * combines the areas' uncertainty.
 */
function getOverallIrt(groups: readonly AreaGroup[]): MockResult["irt"] {
  const estimates = groups.map((group) => estimateAbility(toResponses(group.answers)));

  if (estimates.length === 0) {
    return null;
  }

  const theta = estimates.reduce((sum, estimate) => sum + estimate.theta, 0) / estimates.length;

  const se =
    Math.sqrt(estimates.reduce((sum, estimate) => sum + estimate.se ** 2, 0)) / estimates.length;

  return { ...toScaleRange({ se, theta }), se, theta };
}

/** How each topic went, in the order the mock first asked it. */
function toTopicResults(answers: readonly GradedMockAnswer[]): MockResult["topics"] {
  return [...Map.groupBy(answers, (answer) => answer.skill.id).values()].flatMap((group) => {
    const [first] = group;

    return first
      ? [
          {
            area: first.area,
            correct: group.filter((answer) => answer.outcome === "right").length,
            name: first.skill.name,
            skillId: first.skill.id,
            total: group.length,
          },
        ]
      : [];
  });
}

/** The number a mock is compared on: the exam's own measure. */
export function getMockMeasure(result: Pick<MockResult, "correct" | "irt" | "net" | "total">) {
  if (result.irt) {
    return result.irt.score;
  }

  if (result.net) {
    return result.net.net;
  }

  return result.total > 0 ? Math.round((result.correct / result.total) * PERCENT) : 0;
}

/**
 * Turns a finished mock's graded answers into what it showed: the score in the exam's own terms
 * (estimated item response theory scores by area, Cebraspe's net score with calibration, or right
 * answers), each area and topic, time per question against the exam's pace, and ENEM's
 * coherence.
 */
export function analyzeMock({
  answers,
  conditions,
  minutesUsed,
  preparation,
  previous,
}: {
  answers: readonly GradedMockAnswer[];
  conditions: MockConditions;
  minutesUsed: number;
  preparation: MockResult["preparation"];
  previous: number | null;
}): MockResult {
  const { scoring } = conditions;
  const groups = groupByArea({ answers, conditions });
  const correct = answers.filter((answer) => answer.outcome === "right").length;

  return {
    areas: groups.map((group) => toAreaResult({ conditions, group, scoring })),
    blank: answers.filter((answer) => answer.outcome === "blank").length,
    calibration: scoring === "net" ? getNetCalibration(answers) : null,
    coherence: scoring === "irt" ? getIrtCoherence(toResponses(answers)) : null,
    correct,
    irt: scoring === "irt" ? getOverallIrt(groups) : null,
    minutesUsed,
    net: scoring === "net" ? getNetScore(answers) : null,
    plannedMinutes: conditions.sections.reduce((sum, section) => sum + section.minutes, 0),
    preparation,
    previous,
    scoring,
    topics: toTopicResults(answers),
    total: answers.length,
    unansweredAtTimeout: answers.filter((answer) => answer.timedOut).length,
  };
}
