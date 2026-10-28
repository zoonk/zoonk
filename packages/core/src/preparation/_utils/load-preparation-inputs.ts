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
    /** A mock's blank or an earlier placement skip must not mask the first actual answer. */
    where: { NOT: DONT_KNOW_ANSWER, itemId: { not: null }, skillId: { in: skillIds }, userId },
  });

  return firstAnswers.flatMap((answer) => {
    const skillId = answer.skillId ? owners.get(answer.skillId) : undefined;
    return skillId ? [{ ...answer, skillId }] : [];
  });
}

/** The answer "I don't know yet" records, in placement, a focus test, a session or a mock. */
const DONT_KNOW_ANSWER = { answer: { equals: { dontKnow: true } } };

/**
 * What shows a skill: an answer in one of its lessons (not a bank question), or a right answer to
 * one of the bank's questions in a session (practice, a review, a full review, its mock). A test's
 * answer (placement, even a question of it a session asks, the focus test, a chapter test, a mock
 * taken any time) only says the learner may know it: one right answer frees a topic from its
 * lessons, and practice confirms it.
 */
const SHOWING_ANSWER = {
  OR: [
    { itemId: null },
    { stepId: { not: null } },
    { isCorrect: true, isPlacement: false, studySessionId: { not: null } },
  ],
};

/**
 * When the learner first showed each skill (see `SHOWING_ANSWER`): what shows it, unlike a level
 * they only stated, a ticked subject, or the one right test answer that let the plan skip its
 * lessons or leave it out. "I don't know yet" never counts.
 */
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

/**
 * What the learner showed of one of the goal's skills: it counts from their first answer on it or
 * in one of its lessons, and its recall is its own memory once it has one, else what they remember
 * of the parts they answered. A skill placement only assumed (a ticked subject, a stated level)
 * shows nothing yet, so it can't fade. Each answer shows one goal skill (`owners`): one on a goal
 * skill another's lessons also teach shows that skill alone.
 */
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

  // Once the learner showed it, the skill's own memory is what reviews and practice keep (a
  // finished lesson reviews it once, then sessions ask it), so it alone says what they remember;
  // its lessons' finer skills only stand in before it has any.
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
 * The goal's tests, newest first, every one counted: its mocks, and for a learner whose plan has
 * no mocks, the full reviews that stand in for them too, the ones before their free days ended
 * included.
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

/** The goal as preparation reads it, with its test in real conditions (see `loadGoalTest`). */
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

/**
 * Reads what preparation is made of for one goal: the goal's skills with what the learner showed
 * of each and their memory of it, first answers to questions never seen before, recent tests (an
 * exam's mock exams or full reviews, or another goal's weekly challenges) and their evidence. Learner rows and
 * plan items only; content is read just to find which skills the goal has and its lessons teach.
 */
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
  /** The exam's blueprint a page already read (`readExamBlueprint`), so it isn't read again. */
  blueprint?: ExamBlueprint | null;
  /** Reuse a caller's already owned row; this does not authorize the read. */
  goal?: PreparationGoal;
  goalId: string;
  now: Date;
  /** How the goal's skills are read: a page's reads pass `readGoalPlan`, loaded once per request. */
  readPlan?: PlanReader;
  /** A page's saved plan (`readSavedPlan`), so its graph and settings aren't read again. */
  savedPlan?: Pick<Plan, "graph" | "settings"> | null;
  /** A page's subscription (`readActiveSubscription`); writes check it fresh. */
  subscription?: Subscription | null;
  userId: string;
}) {
  // The goal's test needs only the goal, so it's read while the goal's skills load.
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
    /** The mock exams among the tests: only they estimate a score. */
    mockResults: tests.mocks,
    mocks: tests.tests,
    sectionWeights: weights.sectionWeights,
    skills,
    studiesPastTarget: measuredGoal?.kind === "exam" && fullCourse,
    testKind: test.kind,
    testPlusRequired: test.plusRequired,
  };
}
