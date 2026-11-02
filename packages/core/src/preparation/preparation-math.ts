import { type MasteryState } from "@zoonk/db";

export type PreparationSkill = {
  areaId: string;
  fading: boolean;
  section?: string | null;
  /** FSRS's chance of recalling it now; null when never studied. */
  retrievability: number | null;
  skillId: string;
  state: MasteryState;
  studiedAt: Date | null;
  /** Absent counts as 1. */
  importance?: number;
};

const HARDNESS_WEIGHT = 0.5;

const DIFFICULTY_RANGE = 1;

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

export type UnseenAnswer = { answeredAt: Date; isCorrect: boolean; skillId: string };

export type MockResult = { correct: number; endedAt: Date; total: number };

export type PreparationTestKind = "fullReviews" | "mockExams" | "weeklyChallenges";

export type PreparationComponents = {
  coverage: {
    heaviest: { studiedSkills: number; totalSkills: number; value: number };
    studiedSkills: number;
    totalSkills: number;
    value: number;
  };
  mastery: {
    answered: number;
    correct: number;
    evidence: number;
    supported: number | null;
    value: number | null;
  };
  mocks: { kind: PreparationTestKind; plusRequired: boolean; taken: number; value: number | null };
  retention: { studiedSkills: number; value: number | null };
};

const MASTERY_WINDOW = 40;
const MIN_MASTERY_ANSWERS = 5;
export const RECENT_MOCKS = 3;

const SOLID_PREPARATION = 0.75;

const BELOW_SOLID = 0.74;

const QUALITY_WEIGHTS = { mastery: 0.4, mocks: 0.3, retention: 0.3 } as const;

function isStudiedBy(skill: PreparationSkill, asOf: Date): boolean {
  return skill.studiedAt !== null && skill.studiedAt.getTime() <= asOf.getTime();
}

function importanceOf(skill: Pick<PreparationSkill, "importance">): number {
  return skill.importance ?? 1;
}

export function sumImportance(skills: readonly Pick<PreparationSkill, "importance">[]): number {
  return skills.reduce((sum, skill) => sum + importanceOf(skill), 0);
}

function getHeaviestSkillIds(skills: readonly PreparationSkill[]): Set<string> {
  const sorted = skills.map((skill) => importanceOf(skill)).toSorted((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
  const above = skills.filter((skill) => importanceOf(skill) > median);

  return new Set((above.length > 0 ? above : skills).map((skill) => skill.skillId));
}

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

/** One-sided 95%. */
const MASTERY_CONFIDENCE_Z = 1.645;

/** Wilson's lower bound. */
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
 * Retention has no history, so a past moment uses today's recall for the skills studied by then.
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
  testKind?: PreparationTestKind;
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

export function getPreparationValue(
  components: PreparationComponents,
  { needsTest = true }: { needsTest?: boolean } = {},
): number {
  const { isSolid, quality } = measureQuality({ components, needsTest });
  const prepared = components.coverage.value * quality;
  return isSolid ? prepared : Math.min(prepared, BELOW_SOLID);
}

function measureQuality({
  components,
  needsTest,
}: {
  components: PreparationComponents;
  needsTest: boolean;
}) {
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

/** Solid is the last stage: never "ready", never a promise. */
export type PreparationStage = "building" | "growing" | "solid" | "starting";

const STAGE_THRESHOLDS: readonly { min: number; stage: PreparationStage }[] = [
  { min: SOLID_PREPARATION, stage: "solid" },
  { min: 0.5, stage: "growing" },
  { min: 0.25, stage: "building" },
];

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
