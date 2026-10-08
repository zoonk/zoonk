import "server-only";
import { type Goal, type LearnerSkill, prisma } from "@zoonk/db";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { findActiveSubscription } from "../../auth/subscription";
import { CHECKPOINT_LEDGER_KINDS } from "../../checkpoints/_utils/checkpoint-results";
import { getExamPrepAccess as getTierExamPrep } from "../../entitlements/limits";
import { type GoalSkillNode, loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { toSkillStatus } from "../../learner/_utils/skill-status";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { isFadingRetrievability } from "../../learner/mastery-state";
import { getSkillArea } from "../../plans/planner/graph-areas";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { FULL_REVIEW_LEDGER_KIND } from "../../sessions/_utils/block-events";
import { getExamPrepAccess } from "../../sessions/_utils/exam-access";
import {
  type MockResult,
  type PreparationSkill,
  type PreparationTestKind,
  RECENT_MOCKS,
  type UnseenAnswer,
} from "../preparation-math";
import { loadSkillImportance } from "./skill-importance";

/** Enough mocks for today's three and the three a week ago. */
const MOCKS_TO_READ = RECENT_MOCKS * 2;

/**
 * One of the goal's skills as preparation measures it: its area, and the skills whose answers show
 * it (itself and the finer skills its lessons teach).
 */
type MeasuredSkill = Pick<GoalSkillNode, "areaId" | "memberSkillIds"> & { skillId: string };

/**
 * The whole goal's skills: the plan's, then the ones of its skill graph the plan leaves out for now
 * (no time for them yet), so taking them in later never changes what preparation is out of. Areas
 * the learner took out of the plan aren't part of the goal anymore.
 */
async function loadMeasuredSkills(goalId: string) {
  const [plan, row] = await Promise.all([
    loadGoalPlan(goalId),
    prisma.plan.findUnique({ select: { graph: true, settings: true }, where: { goalId } }),
  ]);

  const graph = parsePlanGraph(row?.graph);
  const skipped = new Set(parsePlanSettings(row?.settings).skippedAreas);
  const graphSkills = graph.skills.filter((skill) => !skipped.has(getSkillArea({ graph, skill })));
  const survivorOf = await loadSkillSurvivors(graphSkills.map((skill) => skill.skillId));
  const planned = new Set(plan.skills.map((node) => node.id));

  const leftOut = graphSkills
    .map((skill) => ({ phase: skill.phase, skillId: survivorOf(skill.skillId) }))
    .filter(
      (skill, index, all) =>
        !planned.has(skill.skillId) &&
        all.findIndex((other) => other.skillId === skill.skillId) === index,
    );

  const skills: MeasuredSkill[] = [
    ...plan.skills.map((node) => ({
      areaId: node.areaId,
      memberSkillIds: node.memberSkillIds,
      skillId: node.id,
    })),
    ...leftOut.map((skill) => ({
      areaId: `phase:${skill.phase}`,
      memberSkillIds: [skill.skillId],
      skillId: skill.skillId,
    })),
  ];

  return {
    graph,
    leftOutIds: new Set(leftOut.map((skill) => skill.skillId)),
    plan,
    skills,
    survivorOf,
  };
}

/**
 * Which of the goal's skills each skill's answers show: the skill itself when it's one of them,
 * otherwise the first one whose lessons teach it.
 */
function toMeasuredSkillOwners(skills: readonly MeasuredSkill[]): Map<string, string> {
  return new Map([
    ...skills
      .toReversed()
      .flatMap((skill) => skill.memberSkillIds.map((id): [string, string] => [id, skill.skillId])),
    ...skills.map((skill): [string, string] => [skill.skillId, skill.skillId]),
  ]);
}

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
    where: { itemId: { not: null }, skillId: { in: skillIds }, userId },
  });

  return firstAnswers.flatMap((answer) => {
    const skillId = answer.skillId ? owners.get(answer.skillId) : undefined;
    return skillId ? [{ ...answer, skillId }] : [];
  });
}

/** The answer "I don't know yet" records, in placement, a focus test, a session or a mock. */
const DONT_KNOW_ANSWER = { answer: { equals: { dontKnow: true } } };

/**
 * A test's answer (placement, the focus test, a chapter test): a bank question answered outside
 * lessons and sessions, as the planner reads gaps from (`loadMissedSkillIds`).
 */
const TEST_ANSWER = { itemId: { not: null }, stepId: null, studySessionId: null };

type FirstAnswerRow = { _min: { answeredAt: Date | null }; skillId: string | null };

function toFirstAnswers(rows: readonly FirstAnswerRow[]): [string, Date][] {
  return rows.flatMap((row) =>
    row.skillId && row._min.answeredAt ? [[row.skillId, row._min.answeredAt]] : [],
  );
}

/**
 * When the learner first answered on each skill: what shows it, unlike a level they only stated.
 * "I don't know yet" and a test answer they missed show the opposite, so they never count. A skill
 * the plan leaves out for now counts only from studying it (a lesson, a session, a mock): the one
 * test answer it rests on is what let the plan leave it out, so it isn't covered until studied.
 */
async function loadFirstAnswers({
  leftOutIds,
  skillIds,
  userId,
}: {
  leftOutIds: ReadonlySet<string>;
  skillIds: string[];
  userId: string;
}) {
  const [shown, studied] = await Promise.all([
    prisma.attempt.groupBy({
      _min: { answeredAt: true },
      by: ["skillId"],
      where: {
        NOT: [DONT_KNOW_ANSWER, { ...TEST_ANSWER, isCorrect: false }],
        skillId: { in: skillIds.filter((skillId) => !leftOutIds.has(skillId)) },
        userId,
      },
    }),
    prisma.attempt.groupBy({
      _min: { answeredAt: true },
      by: ["skillId"],
      where: { NOT: [DONT_KNOW_ANSWER, TEST_ANSWER], skillId: { in: [...leftOutIds] }, userId },
    }),
  ]);

  return new Map([...toFirstAnswers(shown), ...toFirstAnswers(studied)]);
}

function average(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/**
 * What the learner showed of one of the goal's skills: it counts from their first answer on it or
 * in one of its lessons, and its recall is what they remember of the parts they answered. A skill
 * placement only assumed (a ticked subject, a stated level) shows nothing yet, so it can't fade.
 */
function toPreparationSkill({
  firstAnswers,
  importance,
  learnerSkills,
  now,
  skill,
}: {
  firstAnswers: ReadonlyMap<string, Date>;
  importance: ReadonlyMap<string, number>;
  learnerSkills: readonly LearnerSkill[];
  now: Date;
  skill: MeasuredSkill;
}): PreparationSkill {
  const answered = skill.memberSkillIds.filter((id) => firstAnswers.has(id));

  const studiedAt =
    answered
      .map((id) => firstAnswers.get(id))
      .filter((date) => date !== undefined)
      .toSorted((a, b) => a.getTime() - b.getTime())[0] ?? null;

  // The skill itself comes first among its members, so its own state leads once it's answered.
  const statuses = answered.map((id) =>
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
    skillId: skill.skillId,
    state: statuses[0]?.state ?? "new",
    studiedAt,
  };
}

type GoalTest = {
  kind: PreparationTestKind;
  /** The learner's plan has mock exams, so only mocks are the exam's test (see `loadTests`). */
  mocksOnly: boolean;
  plusRequired: boolean;
};

type TestGoal = Pick<Goal, "createdAt" | "kind" | "timezone">;

/**
 * The goal's test in real conditions: an exam's mock exams, or for a learner whose plan has none
 * (a free plan), a full review in the exam's format on the mock's day, which their plan gives them
 * while its free days last and after which only Plus brings a test; every other goal's weekly
 * challenges.
 */
async function loadGoalTest({
  goal,
  now,
  userId,
}: {
  goal: TestGoal | null;
  now: Date;
  userId: string;
}): Promise<GoalTest> {
  if (goal?.kind !== "exam") {
    return { kind: "weeklyChallenges", mocksOnly: false, plusRequired: false };
  }

  const subscription = await findActiveSubscription(userId);
  const timeZone = goal.timezone && isValidTimeZone(goal.timezone) ? goal.timezone : "UTC";

  const access = getExamPrepAccess({
    examPrep: getTierExamPrep(subscription ? "plus" : "free"),
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

/** The ledger rows each kind of test leaves. */
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

/**
 * The goal's recent tests: its mocks, and for a learner whose plan has no mocks, the full reviews
 * that stand in for them too, the ones before their free days ended included.
 */
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
    take: MOCKS_TO_READ,
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

/**
 * Reads what preparation is made of for one goal: the goal's skills with what the learner showed
 * of each and their memory of it, first answers to questions never seen before, recent tests (an
 * exam's mock exams or full reviews, or another goal's weekly challenges) and the plan schedule. Learner rows and
 * plan items only; content is read just to find which skills the goal has and its lessons teach.
 */
export async function loadPreparationInputs({
  goalId,
  now,
  userId,
}: {
  goalId: string;
  now: Date;
  userId: string;
}) {
  const [{ graph, leftOutIds, plan, skills: measured, survivorOf }, goal] = await Promise.all([
    loadMeasuredSkills(goalId),
    prisma.goal.findUnique({
      select: { createdAt: true, details: true, examBlueprintId: true, kind: true, timezone: true },
      where: { id: goalId },
    }),
  ]);

  const evidenceIds = [...new Set(measured.flatMap((skill) => skill.memberSkillIds))];
  const test = await loadGoalTest({ goal, now, userId });

  const [learnerSkills, firstAnswers, answers, tests, schedule, importance] = await Promise.all([
    prisma.learnerSkill.findMany({ where: { skillId: { in: evidenceIds }, userId } }),
    loadFirstAnswers({ leftOutIds, skillIds: evidenceIds, userId }),
    loadUnseenAnswers({ owners: toMeasuredSkillOwners(measured), skillIds: evidenceIds, userId }),
    loadTests({ goalId, test, userId }),
    prisma.plan.findUnique({
      select: { estimateHours: true, items: { select: { scheduledFor: true, status: true } } },
      where: { goalId },
    }),
    loadSkillImportance({ goal, graph, skills: measured, survivorOf }),
  ]);

  const skills = measured.map((skill) =>
    toPreparationSkill({ firstAnswers, importance, learnerSkills, now, skill }),
  );

  const areas = plan.skills
    .filter(
      (node, index) => plan.skills.findIndex((other) => other.areaId === node.areaId) === index,
    )
    .map((node) => ({ areaId: node.areaId, title: node.areaTitle }));

  return {
    answers,
    areas,
    estimateHours: schedule?.estimateHours ?? null,
    /** The mock exams among the tests: only they estimate a score. */
    mockResults: tests.mocks,
    mocks: tests.tests,
    planItems: schedule?.items ?? [],
    skills,
    testKind: test.kind,
    testPlusRequired: test.plusRequired,
  };
}
