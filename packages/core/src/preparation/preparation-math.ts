import { type MasteryState } from "@zoonk/db";

/** One of the goal's skills with what the learner model knows about it. */
export type PreparationSkill = {
  areaId: string;
  fading: boolean;
  /** The chance of recalling it now (FSRS); null when never studied. */
  retrievability: number | null;
  skillId: string;
  state: MasteryState;
  /** When the learner first studied it (an answer, a test-out or placement); null when not yet. */
  studiedAt: Date | null;
};

/** The first answer to a question the learner had never seen. */
export type UnseenAnswer = { answeredAt: Date; isCorrect: boolean; skillId: string };

/** A finished mock exam under real conditions, or a finished weekly challenge. */
export type MockResult = { correct: number; endedAt: Date; total: number };

/**
 * What stands in for the real test in Preparation's fourth part: an exam goal's mock exams, and
 * the weekly challenges for every other goal, which has no exam to rehearse.
 */
export type PreparationTestKind = "mockExams" | "weeklyChallenges";

/**
 * The four honest parts of Preparation, each with its evidence: how much of the goal was studied,
 * accuracy on questions never seen before, how much of what was studied is still remembered, and
 * recent tests: an exam's mock exams, or another goal's weekly challenges. A part without enough evidence is null rather than a guess.
 */
export type PreparationComponents = {
  coverage: { studiedSkills: number; totalSkills: number; value: number };
  mastery: { answered: number; correct: number; value: number | null };
  mocks: { kind: PreparationTestKind; taken: number; value: number | null };
  retention: { studiedSkills: number; value: number | null };
};

/** Mastery reads the latest answers to unseen questions, and needs a few to mean anything. */
const MASTERY_WINDOW = 40;
const MIN_MASTERY_ANSWERS = 5;
export const RECENT_MOCKS = 3;

/** How much each kind of evidence counts toward how well the studied part is known. */
const QUALITY_WEIGHTS = { mastery: 0.4, mocks: 0.3, retention: 0.3 } as const;

function isStudiedBy(skill: PreparationSkill, asOf: Date): boolean {
  return skill.studiedAt !== null && skill.studiedAt.getTime() <= asOf.getTime();
}

function getCoverage({ asOf, skills }: { asOf: Date; skills: readonly PreparationSkill[] }) {
  const studied = skills.filter((skill) => isStudiedBy(skill, asOf)).length;

  return {
    studiedSkills: studied,
    totalSkills: skills.length,
    value: skills.length > 0 ? studied / skills.length : 0,
  };
}

function getMastery({ answers, asOf }: { answers: readonly UnseenAnswer[]; asOf: Date }) {
  const recent = answers
    .filter((answer) => answer.answeredAt.getTime() <= asOf.getTime())
    .toSorted((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime())
    .slice(0, MASTERY_WINDOW);

  const correct = recent.filter((answer) => answer.isCorrect).length;

  return {
    answered: recent.length,
    correct,
    value: recent.length >= MIN_MASTERY_ANSWERS ? correct / recent.length : null,
  };
}

function getRetention({ asOf, skills }: { asOf: Date; skills: readonly PreparationSkill[] }) {
  const recalls = skills
    .filter((skill) => isStudiedBy(skill, asOf))
    .map((skill) => skill.retrievability)
    .filter((value) => value !== null);

  return {
    studiedSkills: recalls.length,
    value:
      recalls.length > 0 ? recalls.reduce((sum, value) => sum + value, 0) / recalls.length : null,
  };
}

function getMocks({
  asOf,
  kind,
  mocks,
}: {
  asOf: Date;
  kind: PreparationTestKind;
  mocks: readonly MockResult[];
}) {
  const recent = mocks
    .filter((mock) => mock.total > 0 && mock.endedAt.getTime() <= asOf.getTime())
    .toSorted((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
    .slice(0, RECENT_MOCKS);

  const scores = recent.map((mock) => mock.correct / mock.total);

  return {
    kind,
    taken: recent.length,
    value: scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
  };
}

/**
 * Computes the components as of one moment, so the same math gives today's numbers and last
 * week's. Retention has no history, so a past moment uses today's recall for skills studied by
 * then: the week's gain comes from what was studied, answered and mocked.
 */
export function getPreparationComponents({
  answers,
  asOf,
  mocks,
  skills,
  testKind = "mockExams",
}: {
  answers: readonly UnseenAnswer[];
  asOf: Date;
  mocks: readonly MockResult[];
  skills: readonly PreparationSkill[];
  /** Whether `mocks` are an exam's mock exams or another goal's weekly challenges. */
  testKind?: PreparationTestKind;
}): PreparationComponents {
  return {
    coverage: getCoverage({ asOf, skills }),
    mastery: getMastery({ answers, asOf }),
    mocks: getMocks({ asOf, kind: testKind, mocks }),
    retention: getRetention({ asOf, skills }),
  };
}

/**
 * One number from 0 to 1: coverage times how well the studied part is known (the weighted mean of
 * the quality evidence available). Studying a little and remembering it well stays small, and
 * nothing is inflated by parts without evidence.
 */
export function getPreparationValue(components: PreparationComponents): number {
  const evidence = [
    { value: components.mastery.value, weight: QUALITY_WEIGHTS.mastery },
    { value: components.retention.value, weight: QUALITY_WEIGHTS.retention },
    { value: components.mocks.value, weight: QUALITY_WEIGHTS.mocks },
  ].flatMap(({ value, weight }) => (value === null ? [] : [{ value, weight }]));

  const totalWeight = evidence.reduce((sum, part) => sum + part.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  const quality = evidence.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight;

  return components.coverage.value * quality;
}

/** The Preparation ring's stages. The last is Solid: never "ready", never a promise. */
export type PreparationStage = "building" | "growing" | "solid" | "starting";

const STAGE_THRESHOLDS: readonly { min: number; stage: PreparationStage }[] = [
  { min: 0.75, stage: "solid" },
  { min: 0.5, stage: "growing" },
  { min: 0.25, stage: "building" },
];

export function getPreparationStage(value: number): PreparationStage {
  return STAGE_THRESHOLDS.find((threshold) => value >= threshold.min)?.stage ?? "starting";
}
