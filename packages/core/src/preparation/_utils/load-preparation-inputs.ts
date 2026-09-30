import "server-only";
import { type GoalKind, type LearningEvent, prisma } from "@zoonk/db";
import { CHECKPOINT_LEDGER_KINDS } from "../../checkpoints/_utils/checkpoint-results";
import { loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { toSkillStatus } from "../../learner/_utils/skill-status";
import {
  type MockResult,
  type PreparationSkill,
  type PreparationTestKind,
  RECENT_MOCKS,
  type UnseenAnswer,
} from "../preparation-math";

/** Enough mocks for today's three and the three a week ago. */
const MOCKS_TO_READ = RECENT_MOCKS * 2;

async function loadUnseenAnswers({
  skillIds,
  userId,
}: {
  skillIds: string[];
  userId: string;
}): Promise<UnseenAnswer[]> {
  const firstAnswers = await prisma.attempt.findMany({
    distinct: ["itemId"],
    orderBy: [{ itemId: "asc" }, { answeredAt: "asc" }],
    select: { answeredAt: true, isCorrect: true, skillId: true },
    where: { itemId: { not: null }, skillId: { in: skillIds }, userId },
  });

  return firstAnswers.flatMap((answer) =>
    answer.skillId ? [{ ...answer, skillId: answer.skillId }] : [],
  );
}

/** An exam rehearses with mock exams; every other goal tests itself with weekly challenges. */
function getTestKind(goalKind: GoalKind | undefined): PreparationTestKind {
  return goalKind === "exam" ? "mockExams" : "weeklyChallenges";
}

const TEST_EVENTS: Readonly<
  Record<PreparationTestKind, Partial<Pick<LearningEvent, "kind" | "lessonKind">>>
> = {
  mockExams: { kind: "mock" },
  weeklyChallenges: { kind: "checkpoint", lessonKind: CHECKPOINT_LEDGER_KINDS.weekly },
};

async function loadMocks({
  goalId,
  testKind,
  userId,
}: {
  goalId: string;
  testKind: PreparationTestKind;
  userId: string;
}): Promise<MockResult[]> {
  const events = await prisma.learningEvent.findMany({
    orderBy: { endedAt: "desc" },
    select: { correctAnswers: true, endedAt: true, incorrectAnswers: true },
    take: MOCKS_TO_READ,
    where: { endedAt: { not: null }, goalId, userId, ...TEST_EVENTS[testKind] },
  });

  return events.flatMap((event) =>
    event.endedAt
      ? [
          {
            correct: event.correctAnswers,
            endedAt: event.endedAt,
            total: event.correctAnswers + event.incorrectAnswers,
          },
        ]
      : [],
  );
}

/**
 * Reads what preparation is made of for one goal: the plan's skills with the learner's memory of
 * each, first answers to questions never seen before, recent tests (an exam's mock exams, or
 * another goal's weekly challenges) and the plan schedule. Learner
 * rows and plan items only; content is read just to find which skills the plan covers.
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
  const [plan, goal] = await Promise.all([
    loadGoalPlan(goalId),
    prisma.goal.findUnique({ select: { kind: true }, where: { id: goalId } }),
  ]);

  const skillIds = plan.skills.map((skill) => skill.id);
  const testKind = getTestKind(goal?.kind);

  const [learnerSkills, answers, mocks, schedule] = await Promise.all([
    prisma.learnerSkill.findMany({ where: { skillId: { in: skillIds }, userId } }),
    loadUnseenAnswers({ skillIds, userId }),
    loadMocks({ goalId, testKind, userId }),
    prisma.plan.findUnique({
      select: { estimateHours: true, items: { select: { scheduledFor: true, status: true } } },
      where: { goalId },
    }),
  ]);

  const skills: PreparationSkill[] = plan.skills.map((node) => {
    const status = toSkillStatus({
      learnerSkill: learnerSkills.find((row) => row.skillId === node.id),
      now,
    });

    return {
      areaId: node.areaId,
      fading: status.fading,
      retrievability: status.retrievability,
      skillId: node.id,
      state: status.state,
      studiedAt: status.studiedAt,
    };
  });

  const areas = plan.skills
    .filter(
      (node, index) => plan.skills.findIndex((other) => other.areaId === node.areaId) === index,
    )
    .map((node) => ({ areaId: node.areaId, title: node.areaTitle }));

  return {
    answers,
    areas,
    estimateHours: schedule?.estimateHours ?? null,
    mocks,
    planItems: schedule?.items ?? [],
    skills,
    testKind,
  };
}
