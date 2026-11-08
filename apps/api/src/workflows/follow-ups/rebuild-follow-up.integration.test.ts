import { waitForSleep } from "@workflow/vitest";
import { generateWholeSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/identity/goal-specificity";
import { classifyMistakeCause } from "@zoonk/ai/tasks/mistakes/cause";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { answerOnboardingQuestion } from "@zoonk/core/view-models/onboarding/answer";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, plannedSkills } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { chapterSkillFixture, courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { mockSession } from "../../../../../packages/core/src/_test-utils/mock-session";
import { createSetUpGoalPlan } from "../../../../../packages/core/src/plans/_test-utils/set-up-plan";
import { POST as retryGoal } from "../../app/v1/goals/[goalId]/generations/route";
import { stopStalledRun } from "../_shared/run-activity";
import { startOnce } from "../_shared/run-token";
import { heldInitialCurriculum } from "../_test-utils/held-initial-curriculum";
import { taskResult } from "../_test-utils/recorded-outputs";
import { getGoalContentToken } from "../goals/goal-content-workflow";
import { getGoalRebuildAsk } from "../goals/goal-rebuild-ask";
import { rebuildGoalCurriculumWorkflow } from "../goals/rebuild-goal-curriculum-workflow";
import { followUpsWorkflow, getFollowUpsToken } from "./follow-ups-workflow";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));
vi.mock("@zoonk/core/analytics/request-platform", () => ({ getRequestPlatform: async () => null }));
vi.mock("@zoonk/ai/tasks/identity/goal-specificity", () => ({ classifyGoalSpecificity: vi.fn() }));

vi.mock("@zoonk/ai/tasks/curriculum/skill-graph-calls", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateWholeSkillGraph: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

const WAIT = { timeout: 10_000 };

const CAUSE = {
  correctAnswer: "since",
  language: "en",
  learnerAnswer: "for",
  misconception: "",
  question: "I've lived here ___ 2020.",
  recentAccuracy: "3 of 5 right",
};

async function savedGoal() {
  const user = await userFixture();
  const organization = await aiOrganizationFixture();
  const course = await courseFixture({ organizationId: organization.id });
  const [band] = await courseBandsFixture({ courseId: course.id, levels: ["beginner"] });

  if (!band) {
    throw new Error("Expected an outlined band");
  }

  const { chapter, lesson, skill } = band;
  await chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id });
  await prisma.chapter.update({ data: { outlineStatus: "completed" }, where: { id: chapter.id } });
  await prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: lesson.id } });

  const opening = {
    course: { id: course.id, key: "course", title: course.title },
    skill: {
      area: "Foundations",
      description: skill.description,
      estimatedLessons: 1,
      id: skill.id,
      key: "skill",
      level: "beginner" as const,
      name: skill.name,
    },
  };

  const goal = await goalFixture({
    curriculumQuestions: ["purpose", "level"],
    details: {
      answered: ["purpose", "level", "placement", "schedule", "buddy", "targetDate"],
      level: "basic",
      onboardingId: crypto.randomUUID(),
      purpose: "overview",
    },
    openingLessonId: lesson.id,
    openingSkill: opening,
    planRevealedAt: null,
    userId: user.id,
  });

  await createSetUpGoalPlan({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Overview" }],
      skills: plannedSkills([skill]).map((entry) => ({ ...entry, courseIds: [course.id] })),
    },
  });

  const graph: GoalSkillGraph = {
    courses: [{ key: "course", levels: ["beginner"], title: course.title }],
    estimatedHours: 0.1,
    phases: [{ estimatedHours: 0.1, milestone: "Use the idea", title: "Deep foundations" }],
    skills: [
      {
        area: "Foundations",
        course: "course",
        description: skill.description,
        estimatedLessons: 1,
        examWeight: null,
        key: "skill",
        level: "beginner",
        name: skill.name,
        outcome: false,
        phase: 1,
        prerequisites: [],
        topics: [],
      },
    ],
  };

  mockSession(user.id);
  vi.mocked(generateWholeSkillGraph).mockResolvedValue({ ...taskResult(graph), repaired: [] });
  return { goal, lesson, user };
}

async function editPurpose(goalId: string) {
  await answerOnboardingQuestion({ goalId, input: { purpose: "deep", question: "purpose" } });

  const row = await prisma.followUp.findFirstOrThrow({
    where: { key: goalId, kind: "rebuildGoalCurriculum" },
  });

  return { id: row.id, revision: row.revision };
}

async function dispatch(userId: string) {
  const runId = await startOnce(followUpsWorkflow, [{ userId }], getFollowUpsToken(userId));
  await expect(getRun(runId).returnValue).resolves.toBeUndefined();
  return runId;
}

async function goalRun(goalId: string) {
  await vi.waitFor(async () => {
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    expect(goal.generationRunId).not.toBeNull();
  }, WAIT);

  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return getRun(goal.generationRunId!);
}

async function retry(goalId: string) {
  const response = await retryGoal(
    new NextRequest(`http://localhost/v1/goals/${goalId}/generations`, { method: "POST" }),
    { params: Promise.resolve({ goalId }) },
  );

  expect(response.status).toBe(202);
  const result = await response.json();
  return getRun(result.generationId);
}

describe("a learner's owed rebuild", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(classifyGoalSpecificity).mockResolvedValue(
      taskResult({ generalGoal: "Foundations", personalDetails: [], privateCourse: false }),
    );

    vi.mocked(classifyMistakeCause).mockResolvedValue({
      data: { cause: "trap" as const },
      provenance: {} as never,
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it(
    "finishes a failed rebuild's row without blocking other owed work",
    { timeout: 60_000 },
    async () => {
      vi.mocked(classifyGoalSpecificity).mockRejectedValue(new Error("refused"));
      const { goal, user } = await savedGoal();
      await editPurpose(goal.id);
      const mistake = await mistakeFixture({ cause: null, userId: user.id });

      await prisma.followUp.create({
        data: {
          input: { cause: CAUSE, mistakeId: mistake.id },
          key: mistake.id,
          kind: "classifyMistakeCause",
          userId: user.id,
        },
      });

      await dispatch(user.id);
      const rebuild = await goalRun(goal.id);
      await expect(rebuild.returnValue).rejects.toThrow();
      await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ).resolves.toMatchObject({ buildFailedAt: expect.any(Date) });
    },
  );

  it(
    "holds the reveal after an edit and opens it when the actual rebuild finishes",
    { timeout: 60_000 },
    async () => {
      const { goal, lesson, user } = await savedGoal();
      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({ plan: { ready: true } });
      await editPurpose(goal.id);
      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({ plan: { ready: false } });
      await dispatch(user.id);
      const rebuild = await goalRun(goal.id);
      await expect(rebuild.returnValue).resolves.toMatchObject({ status: "built" });
      await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);
      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({ plan: { ready: true } });

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ).resolves.toMatchObject({ openingLessonId: lesson.id });

      expect(generateWholeSkillGraph).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: "deep", serviceTier: "priority" }),
      );
    },
  );

  it(
    "leaves failure visible, then the real Try again POST rebuilds and opens the reveal",
    { timeout: 60_000 },
    async () => {
      const { goal, user } = await savedGoal();
      await editPurpose(goal.id);
      vi.mocked(classifyGoalSpecificity).mockRejectedValue(new Error("refused"));
      await dispatch(user.id);
      const failed = await goalRun(goal.id);
      await expect(failed.returnValue).rejects.toThrow();
      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({ plan: { ready: false } });
      await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);

      vi.mocked(classifyGoalSpecificity).mockResolvedValue(
        taskResult({ generalGoal: "Foundations", personalDetails: [], privateCourse: false }),
      );

      const retried = await retry(goal.id);
      expect(retried.runId).not.toBe(failed.runId);
      await expect(retried.returnValue).resolves.toMatchObject({ status: "built" });
      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({ plan: { ready: true } });

      expect(generateWholeSkillGraph).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: "deep" }),
      );
    },
  );

  it(
    "ends a stalled rebuild's row at the actual cancellation call",
    { timeout: 60_000 },
    async () => {
      const user = await userFixture();

      const goal = await goalFixture({
        details: { level: "basic", purpose: "overview" },
        userId: user.id,
      });

      await planFixture({ goalId: goal.id });

      const followUp = await prisma.followUp.create({
        data: {
          input: { goalId: goal.id },
          key: goal.id,
          kind: "rebuildGoalCurriculum",
          userId: user.id,
        },
      });

      const initialId = await startOnce(
        heldInitialCurriculum,
        [],
        getGoalContentToken({ goalId: goal.id }),
      );

      const initial = getRun(initialId);
      const initialWait = await waitForSleep(initial);

      try {
        await dispatch(user.id);
        const rebuild = await goalRun(goal.id);
        await waitForSleep(rebuild);
        vi.stubEnv("NODE_ENV", "development");
        vi.spyOn(process, "uptime").mockReturnValue(0);
        await expect(stopStalledRun(rebuild.runId)).resolves.toMatchObject({ stalled: true });
        await expect(rebuild.status).resolves.toBe("cancelled");
        await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);

        await expect(
          prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
        ).resolves.toMatchObject({ buildFailedAt: expect.any(Date) });

        const oldAsk = {
          followUp: { id: followUp.id, revision: followUp.revision },
          goalId: goal.id,
        };

        const restartedId = await startOnce(
          rebuildGoalCurriculumWorkflow,
          [oldAsk],
          getGoalRebuildAsk(oldAsk),
        );

        await expect(getRun(restartedId).returnValue).rejects.toThrow("no longer owed");
        expect(generateWholeSkillGraph).not.toHaveBeenCalled();
      } finally {
        await initial.wakeUp({ correlationIds: [initialWait] });
        await initial.returnValue;
      }
    },
  );
});
