import "server-only";
import {
  type ExamBlueprint,
  type Goal,
  type LearnerSkill,
  type Plan,
  type Subscription,
  prisma,
} from "@zoonk/db";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { findActiveSubscription } from "../../auth/subscription";
import { CHECKPOINT_LEDGER_KINDS } from "../../checkpoints/_utils/checkpoint-results";
import { getExamPrepAccess as getTierExamPrep } from "../../entitlements/limits";
import { getSkillOwners, loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { toSkillStatus } from "../../learner/_utils/skill-status";
import { isFadingRetrievability } from "../../learner/mastery-state";
import { FULL_REVIEW_LEDGER_KIND } from "../../sessions/_utils/block-events";
import { getExamPrepAccess } from "../../sessions/_utils/exam-access";
import {
  type MockResult,
  type PreparationSkill,
  type PreparationTestKind,
  type UnseenAnswer,
} from "../preparation-math";
import { type MeasuredSkill, type PlanReader, loadMeasuredSkills } from "./load-measured-skills";
import { loadSkillImportance } from "./skill-importance";

async function loadUnseenAnswers({
  owners,
  skillIds,
  userId,
}: {
  owners: ReadonlyMap<string, string>;
  skillIds: string[];
  userId: string;
}): Promise<UnseenAnswer[]> {
  const firstAnswers = await prisma.attempt.findMany({
    distinct: ["itemId"],
    orderBy: [{ itemId: "asc" }, { answeredAt: "asc" }],
    select: { answeredAt: true, isCorrect: true, skillId: true },
    where: { NOT: DONT_KNOW_ANSWER, itemId: { not: null }, skillId: { in: skillIds }, userId },
  });

  return firstAnswers.flatMap((answer) => {
    const skillId = answer.skillId ? owners.get(answer.skillId) : undefined;
    return skillId ? [{ ...answer, skillId }] : [];
  });
}

const DONT_KNOW_ANSWER = { answer: { equals: { dontKnow: true } } };

const SHOWING_ANSWER = {
  OR: [
    { itemId: null },
    { stepId: { not: null } },
    { isCorrect: true, isPlacement: false, studySessionId: { not: null } },
  ],
};

async function loadFirstAnswers({ skillIds, userId }: { skillIds: string[]; userId: string }) {
  const rows = await prisma.attempt.groupBy({
    _min: { answeredAt: true },
    by: ["skillId"],
    where: { ...SHOWING_ANSWER, NOT: DONT_KNOW_ANSWER, skillId: { in: skillIds }, userId },
  });

  return new Map(
    rows.flatMap((row): [string, Date][] =>
      row.skillId && row._min.answeredAt ? [[row.skillId, row._min.answeredAt]] : [],
    ),
  );
}

function average(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function toPreparationSkill({
  firstAnswers,
  importance,
  learnerSkills,
  now,
  owners,
  skill,
}: {
  firstAnswers: ReadonlyMap<string, Date>;
  importance: ReadonlyMap<string, number>;
  learnerSkills: readonly LearnerSkill[];
  now: Date;
  owners: ReadonlyMap<string, string>;
  skill: MeasuredSkill;
}): PreparationSkill {
  const answered = skill.memberSkillIds.filter(
    (id) => firstAnswers.has(id) && owners.get(id) === skill.skillId,
  );

  const studiedAt =
    answered
      .map((id) => firstAnswers.get(id))
      .filter((date) => date !== undefined)
      .toSorted((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const hasOwnMemory = learnerSkills.some((row) => row.skillId === skill.skillId && row.reps > 0);
  const remembered = hasOwnMemory && answered.length > 0 ? [skill.skillId] : answered;

  const statuses = remembered.map((id) =>
    toSkillStatus({ learnerSkill: learnerSkills.find((row) => row.skillId === id), now }),
  );

  const retrievability = average(
    statuses.flatMap((status) => (status.retrievability === null ? [] : [status.retrievability])),
  );

  return {
    areaId: skill.areaId,
    fading: isFadingRetrievability(retrievability),
    importance: importance.get(skill.skillId) ?? 1,
    retrievability,
    section: skill.section,
    skillId: skill.skillId,
    state: statuses[0]?.state ?? "new",
    studiedAt,
  };
}

type GoalTest = { kind: PreparationTestKind; mocksOnly: boolean; plusRequired: boolean };

type TestGoal = Pick<Goal, "createdAt" | "kind" | "timezone">;

async function loadGoalTest({
  goal,
  now,
  subscription,
  userId,
}: {
  goal: TestGoal | null;
  now: Date;
  subscription?: Subscription | null;
  userId: string;
}): Promise<GoalTest> {
  if (goal?.kind !== "exam") {
    return { kind: "weeklyChallenges", mocksOnly: false, plusRequired: false };
  }

  const subscribed =
    subscription === undefined ? await findActiveSubscription(userId) : subscription;

  const timeZone = goal.timezone && isValidTimeZone(goal.timezone) ? goal.timezone : "UTC";

  const access = getExamPrepAccess({
    examPrep: getTierExamPrep(subscribed ? "plus" : "free"),
    goal,
    timeZone,
    today: getDateInTimeZone({ date: now, timeZone }),
  });

  if (access.includesMockExams) {
    return { kind: "mockExams", mocksOnly: true, plusRequired: false };
  }

  return access.trialEnded
    ? { kind: "mockExams", mocksOnly: false, plusRequired: true }
    : { kind: "fullReviews", mocksOnly: false, plusRequired: false };
}

function getTestEvents(kind: PreparationTestKind) {
  switch (kind) {
    case "fullReviews":
      return {
        OR: [
          { kind: "mock" as const },
          { kind: "questions" as const, lessonKind: FULL_REVIEW_LEDGER_KIND },
        ],
      };
    case "mockExams":
      return { kind: "mock" as const };
    case "weeklyChallenges":
      return { kind: "checkpoint" as const, lessonKind: CHECKPOINT_LEDGER_KINDS.weekly };
    default:
      return kind satisfies never;
  }
}

async function loadTests({
  goalId,
  test,
  userId,
}: {
  goalId: string;
  test: GoalTest;
  userId: string;
}): Promise<{ mocks: MockResult[]; tests: MockResult[] }> {
  const kind = test.kind === "mockExams" && !test.mocksOnly ? "fullReviews" : test.kind;

  const events = await prisma.learningEvent.findMany({
    orderBy: { endedAt: "desc" },
    select: { correctAnswers: true, endedAt: true, incorrectAnswers: true, kind: true },
    where: { endedAt: { not: null }, goalId, userId, ...getTestEvents(kind) },
  });

  const tests = events.flatMap((event) =>
    event.endedAt
      ? [
          {
            correct: event.correctAnswers,
            endedAt: event.endedAt,
            isMock: event.kind === "mock",
            total: event.correctAnswers + event.incorrectAnswers,
          },
        ]
      : [],
  );

  const toResult = ({ correct, endedAt, total }: (typeof tests)[number]) => ({
    correct,
    endedAt,
    total,
  });

  return {
    mocks: tests.filter((entry) => entry.isMock).map((entry) => toResult(entry)),
    tests: tests.map((entry) => toResult(entry)),
  };
}

type PreparationGoal = Pick<
  Goal,
  "createdAt" | "details" | "examBlueprintId" | "kind" | "timezone"
>;

async function loadGoalWithTest({
  goal: providedGoal,
  goalId,
  now,
  subscription,
  userId,
}: {
  goal?: PreparationGoal;
  goalId: string;
  now: Date;
  subscription?: Subscription | null;
  userId: string;
}) {
  const goal =
    providedGoal ??
    (await prisma.goal.findUnique({
      select: { createdAt: true, details: true, examBlueprintId: true, kind: true, timezone: true },
      where: { id: goalId },
    }));

  return { goal, test: await loadGoalTest({ goal, now, subscription, userId }) };
}

export async function loadPreparationInputs({
  blueprint,
  goal,
  goalId,
  now,
  readPlan = loadGoalPlan,
  savedPlan,
  subscription,
  userId,
}: {
  blueprint?: ExamBlueprint | null;
  /** An already owned row to reuse; this doesn't authorize the read. */
  goal?: PreparationGoal;
  goalId: string;
  now: Date;
  readPlan?: PlanReader;
  savedPlan?: Pick<Plan, "graph" | "settings"> | null;
  subscription?: Subscription | null;
  userId: string;
}) {
  const [
    { choices, fullCourse, graph, plan, skills: measured, survivorOf },
    { goal: measuredGoal, test },
  ] = await Promise.all([
    loadMeasuredSkills({ goalId, readPlan, savedPlan }),
    loadGoalWithTest({ goal, goalId, now, subscription, userId }),
  ]);

  const evidenceIds = [...new Set(measured.flatMap((skill) => skill.memberSkillIds))];

  const owners = getSkillOwners(
    measured.map((skill) => ({ id: skill.skillId, memberSkillIds: skill.memberSkillIds })),
  );

  const [learnerSkills, firstAnswers, answers, tests, weights] = await Promise.all([
    prisma.learnerSkill.findMany({ where: { skillId: { in: evidenceIds }, userId } }),
    loadFirstAnswers({ skillIds: evidenceIds, userId }),
    loadUnseenAnswers({ owners, skillIds: evidenceIds, userId }),
    loadTests({ goalId, test, userId }),
    loadSkillImportance({
      blueprint,
      choices,
      goal: measuredGoal,
      graph,
      skills: measured,
      survivorOf,
    }),
  ]);

  const skills = measured.map((skill) =>
    toPreparationSkill({
      firstAnswers,
      importance: weights.importance,
      learnerSkills,
      now,
      owners,
      skill,
    }),
  );

  const areas = plan.skills
    .filter(
      (node, index) => plan.skills.findIndex((other) => other.areaId === node.areaId) === index,
    )
    .map((node) => ({ areaId: node.areaId, title: node.areaTitle }));

  return {
    answers,
    areas,
    mockResults: tests.mocks,
    mocks: tests.tests,
    sectionWeights: weights.sectionWeights,
    skills,
    studiesPastTarget: measuredGoal?.kind === "exam" && fullCourse,
    testKind: test.kind,
    testPlusRequired: test.plusRequired,
  };
}
