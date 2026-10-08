import { type MasteryState } from "@zoonk/db";

/** One of the goal's skills with what the learner model knows about it. */
export type PreparationSkill = {
  areaId: string;
  fading: boolean;
  /** The chance of recalling it now (FSRS); null when never studied. */
  retrievability: number | null;
  skillId: string;
  state: MasteryState;
  /**
   * When the learner first showed it: their first answer on it or in one of its lessons (a lesson,
   * practice, placement, a test-out or a mock), never "I don't know yet". Null when not yet, even
   * when placement assumed it known from a ticked subject or a stated level: that skips lessons but
   * isn't preparation.
   */
  studiedAt: Date | null;
  /**
   * How much the skill counts toward preparation: what the exam asks of it times how hard it is
   * (see `getSkillImportance`). Absent counts as 1, every skill alike.
   */
  importance?: number;
};

/** How much harder skills count: a hard skill (difficulty 1) half again, an easy one (-1) half. */
const HARDNESS_WEIGHT = 0.5;

/** The item bank's difficulty scale: the generator's easy, medium and hard are -1, 0 and 1. */
const DIFFICULTY_RANGE = 1;

/**
 * How much a skill counts toward preparation: the exam's weight on it (`weight`: its part's share
 * of the score, the learner's course's weights and how often the exam asks its topics, as the
 * planner weighs it; 1 for goals without one) times how hard it is (`difficulty` on the item
 * bank's scale, clamped to easy..hard): a hard skill counts 1.5 times a medium one, an easy one
 * half.
 */
export function getSkillImportance({
  difficulty,
  weight,
}: {
  difficulty: number;
  weight: number;
}): number {
  const hardness = Math.min(DIFFICULTY_RANGE, Math.max(-DIFFICULTY_RANGE, difficulty));
  return Math.max(0, weight) * (1 + HARDNESS_WEIGHT * hardness);
}

/** The first answer to a question the learner had never seen. */
export type UnseenAnswer = { answeredAt: Date; isCorrect: boolean; skillId: string };

/** A finished mock exam under real conditions, or a finished weekly challenge. */
export type MockResult = { correct: number; endedAt: Date; total: number };

/**
 * What stands in for the real test in Preparation's fourth part: an exam goal's mock exams, or its
 * full reviews in the exam's format when the learner's plan has no mocks (a free plan's), and the
 * weekly challenges for every other goal, which has no exam to rehearse.
 */
export type PreparationTestKind = "fullReviews" | "mockExams" | "weeklyChallenges";

/**
 * The four honest parts of Preparation, each with its evidence: how much of the goal was studied,
 * accuracy on questions never seen before, how much of what was studied is still remembered, and
 * recent tests: an exam's mock exams, or another goal's weekly challenges. A part without enough evidence is null rather than a guess.
 */
export type PreparationComponents = {
  coverage: {
    /**
     * The goal's heavier part (its hardest and most asked skills, see `getHeaviestSkillIds`) and
     * how much of it was studied: preparation reads as solid only once this part is too, so it
     * never looks ready while the hard, heavily weighted topics have no evidence.
     */
    heaviest: { studiedSkills: number; totalSkills: number; value: number };
    studiedSkills: number;
    totalSkills: number;
    /** The share of the goal studied, each skill counting by its importance. */
    value: number;
  };
  mastery: {
    answered: number;
    correct: number;
    /**
     * How many answers the weighted ones are worth as evidence, (Σw)²/Σw²: as many as were given
     * when every answer counts alike, fewer when a few weigh most.
     */
    evidence: number;
    /** The share right, each answer counting by its skill's importance. */
    value: number | null;
  };
  mocks: {
    kind: PreparationTestKind;
    /**
     * The test needs Plus now: the learner's plan has no mocks and its free days are over, so
     * there's no full review to take either.
     */
    plusRequired: boolean;
    taken: number;
    value: number | null;
  };
  retention: { studiedSkills: number; value: number | null };
};

/** Mastery reads the latest answers to unseen questions, and needs a few to mean anything. */
const MASTERY_WINDOW = 40;
const MIN_MASTERY_ANSWERS = 5;
export const RECENT_MOCKS = 3;

/** Preparation from here on reads as Solid, the ring's last stage. */
const SOLID_PREPARATION = 0.75;

/** The most preparation reads before the heavier part has the evidence Solid needs. */
const BELOW_SOLID = 0.74;

/** How much each kind of evidence counts toward how well the studied part is known. */
const QUALITY_WEIGHTS = { mastery: 0.4, mocks: 0.3, retention: 0.3 } as const;

function isStudiedBy(skill: PreparationSkill, asOf: Date): boolean {
  return skill.studiedAt !== null && skill.studiedAt.getTime() <= asOf.getTime();
}

function importanceOf(skill: Pick<PreparationSkill, "importance">): number {
  return skill.importance ?? 1;
}

function sumImportance(skills: readonly PreparationSkill[]): number {
  return skills.reduce((sum, skill) => sum + importanceOf(skill), 0);
}

/**
 * The goal's heavier part: the skills more important than the median one (harder, or asked more),
 * or all of them when they count alike.
 */
function getHeaviestSkillIds(skills: readonly PreparationSkill[]): Set<string> {
  const sorted = skills.map((skill) => importanceOf(skill)).toSorted((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
  const above = skills.filter((skill) => importanceOf(skill) > median);

  return new Set((above.length > 0 ? above : skills).map((skill) => skill.skillId));
}

/** The skills studied by then, by count and by importance. */
function measureStudied({ asOf, skills }: { asOf: Date; skills: readonly PreparationSkill[] }) {
  const studied = skills.filter((skill) => isStudiedBy(skill, asOf));
  const total = sumImportance(skills);

  return {
    studiedSkills: studied.length,
    totalSkills: skills.length,
    value: total > 0 ? sumImportance(studied) / total : 0,
  };
}

function getCoverage({ asOf, skills }: { asOf: Date; skills: readonly PreparationSkill[] }) {
  const heaviest = getHeaviestSkillIds(skills);

  return {
    ...measureStudied({ asOf, skills }),
    heaviest: measureStudied({
      asOf,
      skills: skills.filter((skill) => heaviest.has(skill.skillId)),
    }),
  };
}

function getMastery({
  answers,
  asOf,
  importance,
}: {
  answers: readonly UnseenAnswer[];
  asOf: Date;
  importance: ReadonlyMap<string, number>;
}) {
  const recent = answers
    .filter((answer) => answer.answeredAt.getTime() <= asOf.getTime())
    .toSorted((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime())
    .slice(0, MASTERY_WINDOW);

  const weights = recent.map((answer) => importance.get(answer.skillId) ?? 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const squares = weights.reduce((sum, weight) => sum + weight ** 2, 0);

  const right = recent.reduce(
    (sum, answer, index) => sum + (answer.isCorrect ? (weights[index] ?? 1) : 0),
    0,
  );

  return {
    answered: recent.length,
    correct: recent.filter((answer) => answer.isCorrect).length,
    evidence: squares > 0 ? total ** 2 / squares : 0,
    value: recent.length >= MIN_MASTERY_ANSWERS && total > 0 ? right / total : null,
  };
}

function getRetention({ asOf, skills }: { asOf: Date; skills: readonly PreparationSkill[] }) {
  const recalls = skills.flatMap((skill) =>
    isStudiedBy(skill, asOf) && skill.retrievability !== null
      ? [{ value: skill.retrievability, weight: importanceOf(skill) }]
      : [],
  );

  const total = recalls.reduce((sum, recall) => sum + recall.weight, 0);

  return {
    studiedSkills: recalls.length,
    value:
      total > 0
        ? recalls.reduce((sum, recall) => sum + recall.value * recall.weight, 0) / total
        : null,
  };
}

function getMocks({
  asOf,
  kind,
  mocks,
  plusRequired,
}: {
  asOf: Date;
  kind: PreparationTestKind;
  mocks: readonly MockResult[];
  plusRequired: boolean;
}) {
  const recent = mocks
    .filter((mock) => mock.total > 0 && mock.endedAt.getTime() <= asOf.getTime())
    .toSorted((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
    .slice(0, RECENT_MOCKS);

  const scores = recent.map((mock) => mock.correct / mock.total);

  return {
    kind,
    plusRequired,
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
  testPlusRequired = false,
}: {
  answers: readonly UnseenAnswer[];
  asOf: Date;
  mocks: readonly MockResult[];
  skills: readonly PreparationSkill[];
  /** Whether `mocks` are an exam's mock exams or another goal's weekly challenges. */
  testKind?: PreparationTestKind;
  /** The test needs Plus now (see `PreparationComponents["mocks"]`). */
  testPlusRequired?: boolean;
}): PreparationComponents {
  const importance = new Map(skills.map((skill) => [skill.skillId, importanceOf(skill)]));

  return {
    coverage: getCoverage({ asOf, skills }),
    mastery: getMastery({ answers, asOf, importance }),
    mocks: getMocks({ asOf, kind: testKind, mocks, plusRequired: testPlusRequired }),
    retention: getRetention({ asOf, skills }),
  };
}

/** One-sided 95%: what a share of right answers is at least, given how many there were. */
const MASTERY_CONFIDENCE_Z = 1.645;

/**
 * The share of right answers the evidence supports (Wilson's lower bound): five right of five says
 * less than forty of forty, so a few right answers on a small plan never read as everything known.
 */
function getSupportedMastery(mastery: PreparationComponents["mastery"]): number | null {
  const { evidence, value } = mastery;

  if (value === null || evidence <= 0) {
    return value;
  }

  const z2 = MASTERY_CONFIDENCE_Z ** 2;
  const halfZ = MASTERY_CONFIDENCE_Z / 2;
  const spread = Math.sqrt((value * (1 - value)) / evidence + (halfZ / evidence) ** 2);
  const center = value + z2 / (2 * evidence);

  return Math.max(0, (center - MASTERY_CONFIDENCE_Z * spread) / (1 + z2 / evidence));
}

/**
 * One number from 0 to 1 that never says more than the evidence does. The rule:
 *
 * - Each skill counts by its importance: the exam's weight on it (its part's share of the score,
 *   the learner's course's weights, how often the exam asks its topics) times how hard it is (its
 *   questions' difficulty, calibrated from every learner's answers, or its place in the skill
 *   graph): a hard, frequent topic counts several times an easy, rare one.
 * - Coverage is the share of that importance the learner has shown on (answered, never "I don't
 *   know yet"): an untested topic counts as not ready, whatever a stated level or a ticked subject
 *   says.
 * - How well the studied part is known is the weighted mean of the evidence there is: accuracy on
 *   questions never seen before (each answer counting by its skill's importance, read only as far
 *   as the number of answers supports, Wilson's lower bound), what's still remembered, and mock
 *   exams or weekly challenges.
 * - Preparation is coverage times that, and it reaches Solid only when the goal's heavier part (its
 *   hardest and most asked skills) studied times that reaches it too, and after a test in the real
 *   conditions (a mock exam, a full review in the exam's format when the learner's plan has no
 *   mocks, or another goal's weekly challenge): a learner who did the easy part well, or practiced
 *   only question by question, stays below Solid, but never for a test their plan can't take.
 */
export function getPreparationValue(
  components: PreparationComponents,
  {
    needsTest = true,
  }: {
    /**
     * Whether Solid waits for a test in real conditions: false for one area of the goal, which
     * mocks don't measure on their own (they span every area).
     */
    needsTest?: boolean;
  } = {},
): number {
  const evidence = [
    { value: getSupportedMastery(components.mastery), weight: QUALITY_WEIGHTS.mastery },
    { value: components.retention.value, weight: QUALITY_WEIGHTS.retention },
    { value: components.mocks.value, weight: QUALITY_WEIGHTS.mocks },
  ].flatMap(({ value, weight }) => (value === null ? [] : [{ value, weight }]));

  const totalWeight = evidence.reduce((sum, part) => sum + part.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  const quality = evidence.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight;
  const { heaviest, value } = components.coverage;
  const prepared = value * quality;
  const hasTest = !needsTest || components.mocks.taken > 0;
  const isSolid = hasTest && heaviest.value * quality >= SOLID_PREPARATION;

  return isSolid ? prepared : Math.min(prepared, BELOW_SOLID);
}

/** The Preparation ring's stages. The last is Solid: never "ready", never a promise. */
export type PreparationStage = "building" | "growing" | "solid" | "starting";

const STAGE_THRESHOLDS: readonly { min: number; stage: PreparationStage }[] = [
  { min: SOLID_PREPARATION, stage: "solid" },
  { min: 0.5, stage: "growing" },
  { min: 0.25, stage: "building" },
];

export function getPreparationStage(value: number): PreparationStage {
  return STAGE_THRESHOLDS.find((threshold) => value >= threshold.min)?.stage ?? "starting";
}
