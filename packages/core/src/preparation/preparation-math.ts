import { type MasteryState } from "@zoonk/db";

/** One of the goal's skills with what the learner model knows about it. */
export type PreparationSkill = {
  areaId: string;
  fading: boolean;
  /**
   * The section of the goal's skill graph it belongs to: the area the planner and the syllabus's
   * subjects name it by, such as an exam's "Matemática". Absent or null when the graph names none.
   */
  section?: string | null;
  /** The chance of recalling it now (FSRS); null when never studied. */
  retrievability: number | null;
  skillId: string;
  state: MasteryState;
  /**
   * When the learner first showed it: their first answer in one of its lessons, or their first
   * right answer to it in practice (a session's questions, its full review or mock), never "I don't
   * know yet". Null when not yet, even when a test took it as known (one right placement answer, a
   * ticked subject, a stated level): that skips lessons, and practice still has to confirm it.
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
    /**
     * The share right the answers support (Wilson's lower bound): what preparation counts and the
     * part shows, since five right of five says less than forty of forty.
     */
    supported: number | null;
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
    /** Every test taken by then; `value` averages the latest few (`RECENT_MOCKS`). */
    taken: number;
    value: number | null;
  };
  retention: { studiedSkills: number; value: number | null };
};

/** Mastery reads the latest answers to unseen questions, and needs a few to mean anything. */
const MASTERY_WINDOW = 40;
const MIN_MASTERY_ANSWERS = 5;
export const RECENT_MOCKS = 3;

/** The minimum preparation for Solid; the goal's evidence must also satisfy its guard. */
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

/** How much these skills count toward preparation together. */
export function sumImportance(skills: readonly Pick<PreparationSkill, "importance">[]): number {
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

/** One-sided 95%: what a share of right answers is at least, given how many there were. */
const MASTERY_CONFIDENCE_Z = 1.645;

/**
 * The share of right answers the evidence supports (Wilson's lower bound): five right of five says
 * less than forty of forty, so a few right answers on a small plan never read as everything known.
 */
function getSupportedMastery({
  evidence,
  value,
}: {
  evidence: number;
  value: number | null;
}): number | null {
  if (value === null || evidence <= 0) {
    return value;
  }

  const z2 = MASTERY_CONFIDENCE_Z ** 2;
  const halfZ = MASTERY_CONFIDENCE_Z / 2;
  const spread = Math.sqrt((value * (1 - value)) / evidence + (halfZ / evidence) ** 2);
  const center = value + z2 / (2 * evidence);

  return Math.max(0, (center - MASTERY_CONFIDENCE_Z * spread) / (1 + z2 / evidence));
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

  const evidence = squares > 0 ? total ** 2 / squares : 0;
  const value = recent.length >= MIN_MASTERY_ANSWERS && total > 0 ? right / total : null;

  return {
    answered: recent.length,
    correct: recent.filter((answer) => answer.isCorrect).length,
    evidence,
    supported: getSupportedMastery({ evidence, value }),
    value,
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
  const taken = mocks
    .filter((mock) => mock.total > 0 && mock.endedAt.getTime() <= asOf.getTime())
    .toSorted((a, b) => b.endedAt.getTime() - a.endedAt.getTime());

  const scores = taken.slice(0, RECENT_MOCKS).map((mock) => mock.correct / mock.total);

  return {
    kind,
    plusRequired,
    taken: taken.length,
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

/**
 * One number from 0 to 1 that never says more than the evidence does. The rule:
 *
 * - Each skill counts by its importance: the exam's weight on it (its part's share of the score,
 *   the learner's course's weights, how often the exam asks its topics) times how hard it is (its
 *   questions' difficulty, calibrated from every learner's answers, or its place in the skill
 *   graph): a hard, frequent topic counts several times an easy, rare one.
 * - Coverage is the share of that importance the learner has shown (studied in its lessons, or
 *   answered right in practice): an untested topic counts as not ready, and so does one a test
 *   only took as known (one right answer, a stated level, a ticked subject) until practice
 *   confirms it.
 * - How well the studied part is known weighs every part the learner can have, one without
 *   evidence yet counting as none, so new evidence never lowers the number: accuracy on questions
 *   never seen before (each answer counting by its skill's importance, read only as far as the
 *   number of answers supports, Wilson's lower bound), what's still remembered, and mock exams or
 *   weekly challenges (unless the learner's plan can't take one). One area, which mocks don't
 *   measure alone, reads how well its studied part is known from the evidence there is.
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
  const { isSolid, quality } = measureQuality({ components, needsTest });
  const prepared = components.coverage.value * quality;
  return isSolid ? prepared : Math.min(prepared, BELOW_SOLID);
}

/** The shared evidence guard for a goal's Solid stage and individual preparation values. */
function measureQuality({
  components,
  needsTest,
}: {
  components: PreparationComponents;
  needsTest: boolean;
}) {
  // The goal counts every part the learner can have, a missing one as none, so new evidence only
  // adds (a test their plan can't take isn't one of them). One area reads how well its studied
  // part is known, where practice is needed, from the evidence there is.
  const canTest = needsTest && !components.mocks.plusRequired;

  const parts = [
    { value: components.mastery.supported, weight: QUALITY_WEIGHTS.mastery },
    { value: components.retention.value, weight: QUALITY_WEIGHTS.retention },
    ...(canTest ? [{ value: components.mocks.value, weight: QUALITY_WEIGHTS.mocks }] : []),
  ].filter((part) => needsTest || part.value !== null);

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);

  if (totalWeight === 0) {
    return { isSolid: false, quality: 0 };
  }

  const quality =
    parts.reduce((sum, part) => sum + (part.value ?? 0) * part.weight, 0) / totalWeight;

  const hasTest = !needsTest || components.mocks.taken > 0;
  const isSolid = hasTest && components.coverage.heaviest.value * quality >= SOLID_PREPARATION;
  return { isSolid, quality };
}

/** The Preparation ring's stages. The last is Solid: never "ready", never a promise. */
export type PreparationStage = "building" | "growing" | "solid" | "starting";

const STAGE_THRESHOLDS: readonly { min: number; stage: PreparationStage }[] = [
  { min: SOLID_PREPARATION, stage: "solid" },
  { min: 0.5, stage: "growing" },
  { min: 0.25, stage: "building" },
];

/** A goal's stage needs its evidence: a subject mean alone cannot establish Solid. */
export function getPreparationStage({
  value,
  components,
}: {
  value: number;
  components: PreparationComponents;
}): PreparationStage {
  if (value >= SOLID_PREPARATION && !measureQuality({ components, needsTest: true }).isSolid) {
    return "growing";
  }

  return STAGE_THRESHOLDS.find((threshold) => value >= threshold.min)?.stage ?? "starting";
}
