import { randomUUID } from "node:crypto";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { type GoalDraft } from "../../goals/goal-contract";
import { recordGoalGeneration } from "../../goals/record-goal-generation";
import { answerOnboardingQuestion } from "./answer-onboarding-question";
import { createOnboardingGoals } from "./create-onboarding-goals";
import { getOnboarding } from "./get-onboarding";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

function draft(attrs: Partial<GoalDraft> = {}): GoalDraft {
  return {
    details: { onboardingId: randomUUID(), subject: "Quantum physics" },
    kind: "learn",
    language: "en",
    prompt: "i want to understand quantum physics",
    title: "Understand quantum physics",
    ...attrs,
  };
}

async function useLearner({ plus = false } = {}) {
  const user = await userFixture();

  if (plus) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  mockSession(user.id);
  return user;
}

async function createGoal(goals: GoalDraft[] = [draft()]) {
  const result = await createOnboardingGoals({ dailyMinutes: 15, goals });

  if (result.status !== "created") {
    throw new Error(`Goal wasn't created: ${result.status}`);
  }

  return result.goals;
}

async function getSteps(goalId: string) {
  const result = await getOnboarding({ goalId });
  return result.status === "ready" ? result.onboarding.steps : [];
}

describe("onboarding a new goal", () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("creates the confirmed goal and asks memory to learn from it", async () => {
    await useLearner();
    const [goal] = await createGoal();

    expect(goal?.title).toBe("Understand quantum physics");
    expect(after).toHaveBeenCalledOnce();
  });

  it("links the material attached to the goal, so research and the curriculum read it", async () => {
    const [user, other] = await Promise.all([useLearner(), userFixture()]);
    const [notes, theirs] = await Promise.all([sourceFixture(), sourceFixture()]);

    await Promise.all([
      learnerSourceFixture({ sourceId: notes.id, userId: user.id }),
      learnerSourceFixture({ sourceId: theirs.id, userId: other.id }),
    ]);

    const result = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [draft()],
      sourceIds: [notes.id, theirs.id],
    });

    const [goal] = result.status === "created" ? result.goals : [];

    const [mine, others] = await Promise.all([
      prisma.learnerSource.findFirstOrThrow({ where: { sourceId: notes.id, userId: user.id } }),
      prisma.learnerSource.findFirstOrThrow({ where: { sourceId: theirs.id, userId: other.id } }),
    ]);

    expect(mine.goalId).toBe(goal?.id);
    expect(others.goalId).toBeNull();
  });

  it("lists only what's still missing, then the profile, placement and the plan", async () => {
    await useLearner();
    const [goal] = await createGoal();
    const result = await getOnboarding({ goalId: goal?.id ?? "" });

    expect(result).toMatchObject({
      onboarding: {
        followUps: [],
        generationId: null,
        goal: { id: goal?.id },
        goalIds: [goal?.id],
        isMinor: false,
        steps: [
          "purpose",
          "targetDate",
          "level",
          "schedule",
          "age",
          "mode",
          "buddy",
          "placement",
          "plan",
        ],
      },
      status: "ready",
    });
  });

  it("shows the run writing the curriculum once it starts, to follow it live", async () => {
    await useLearner();
    const [goal] = await createGoal();
    await recordGoalGeneration({ generationId: "curriculum-run", goalId: goal?.id ?? "" });

    await expect(getOnboarding({ goalId: goal?.id ?? "" })).resolves.toMatchObject({
      onboarding: { generationId: "curriculum-run" },
    });
  });

  it("lists an exam's subjects from its stored notice, for the tiles before placement", async () => {
    const user = await useLearner();

    const blueprint = await prisma.examBlueprint.create({
      data: {
        country: "BR",
        identityKey: `e2e-exam-${randomUUID()}`,
        language: "en",
        model: "test",
        name: "Test exam",
        promptVersion: "test",
        runId: "test",
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: ["Languages", "Math"].map((name) => ({
            citation: { passage: name, sourceId: randomUUID() },
            name,
            questions: 45,
            topics: [],
            weight: null,
          })),
        },
      },
    });

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await expect(getOnboarding({ goalId: goal.id })).resolves.toMatchObject({
      onboarding: { examSubjects: ["Languages", "Math"] },
    });
  });

  it("offers a Library course that teaches the goal once every question is answered", async () => {
    await useLearner();
    const subject = `Tide pools ${randomUUID().slice(0, 8)}`;
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(subject),
      organizationId: organization.id,
      title: subject,
    });

    const [goal] = await createGoal([
      draft({ details: { onboardingId: randomUUID(), subject }, title: `Learn ${subject}` }),
    ]);

    const goalId = goal?.id ?? "";

    await expect(getOnboarding({ goalId })).resolves.toMatchObject({
      onboarding: { libraryCourse: null },
    });

    await answerOnboardingQuestion({ goalId, input: { purpose: "overview", question: "purpose" } });
    await answerOnboardingQuestion({ goalId, input: { question: "targetDate", targetDate: null } });
    await answerOnboardingQuestion({ goalId, input: { level: "none", question: "level" } });
    await answerOnboardingQuestion({ goalId, input: { dailyMinutes: 15, question: "schedule" } });

    await expect(getOnboarding({ goalId })).resolves.toMatchObject({
      onboarding: {
        libraryCourse: {
          brandSlug: organization.slug,
          chapterCount: 0,
          courseSlug: course.slug,
          title: subject,
        },
      },
    });
  });

  it("never asks a question twice, even when it was skipped", async () => {
    await useLearner();
    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";

    await answerOnboardingQuestion({ goalId, input: { purpose: "work", question: "purpose" } });
    const afterPurpose = await getSteps(goalId);
    expect(afterPurpose.slice(0, 2)).toStrictEqual(["role", "targetDate"]);

    await answerOnboardingQuestion({ goalId, input: { question: "role", role: null } });
    await answerOnboardingQuestion({ goalId, input: { question: "targetDate", targetDate: null } });
    await answerOnboardingQuestion({ goalId, input: { level: "basic", question: "level" } });

    await expect(getSteps(goalId)).resolves.toStrictEqual([
      "schedule",
      "age",
      "mode",
      "buddy",
      "placement",
      "plan",
    ]);

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(saved.details).toMatchObject({
      answered: ["purpose", "role", "targetDate", "level"],
      level: "basic",
      purpose: "work",
    });
  });

  it("saves the role with what it's for at work", async () => {
    await useLearner();
    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";

    await answerOnboardingQuestion({ goalId, input: { purpose: "work", question: "purpose" } });

    await answerOnboardingQuestion({
      goalId,
      input: { question: "role", role: "Marketing analyst", tasks: "A/B tests and reports" },
    });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(saved.details).toMatchObject({
      purpose: "work",
      role: "Marketing analyst",
      tasks: "A/B tests and reports",
    });
  });

  it("saves the role a career change aims for, leaving out what was skipped", async () => {
    await useLearner();
    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";

    await answerOnboardingQuestion({
      goalId,
      input: { purpose: "careerChange", question: "purpose" },
    });

    await answerOnboardingQuestion({
      goalId,
      input: { question: "role", role: null, targetPosition: "Data analyst" },
    });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(saved.details).toMatchObject({
      purpose: "careerChange",
      targetPosition: "Data analyst",
    });

    expect(saved.details).not.toHaveProperty("role");
    await expect(getSteps(goalId)).resolves.not.toContain("role");
  });

  it("saves the date and the schedule on the goal", async () => {
    await useLearner();
    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";

    const dated = await answerOnboardingQuestion({
      goalId,
      input: { question: "targetDate", targetDate: "2099-03-31" },
    });

    const scheduled = await answerOnboardingQuestion({
      goalId,
      input: {
        dailyMinutes: 45,
        question: "schedule",
        studyDays: [1, 2, 3, 4, 5],
        studyTime: "20:00",
        timeZone: "America/Sao_Paulo",
      },
    });

    expect([dated, scheduled]).toStrictEqual([{ status: "saved" }, { status: "saved" }]);

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(saved).toMatchObject({ dailyMinutes: 45, studyTime: "20:00" });
    expect(saved.targetDate?.toISOString().slice(0, 10)).toBe("2099-03-31");
  });

  it("splits the day's time between goals typed together, the main one first", async () => {
    await useLearner({ plus: true });
    const onboardingId = randomUUID();

    const goals = await createGoal([
      draft({ details: { onboardingId, subject: "ENEM" }, kind: "exam", title: "Pass the ENEM" }),
      draft({
        details: { onboardingId, subject: "English" },
        kind: "language",
        targetLanguage: "en",
        title: "English",
      }),
    ]);

    const [main, other] = goals;
    const onboarding = await getOnboarding({ goalId: main?.id ?? "" });

    expect(onboarding.status === "ready" && onboarding.onboarding.goalIds).toStrictEqual([
      main?.id,
      other?.id,
    ]);

    await answerOnboardingQuestion({
      goalId: main?.id ?? "",
      input: { dailyMinutes: 60, question: "schedule" },
    });

    const saved = await prisma.goal.findMany({
      orderBy: { createdAt: "asc" },
      where: { id: { in: [main?.id ?? "", other?.id ?? ""] } },
    });

    expect(saved.map((goal) => goal.dailyMinutes)).toStrictEqual([40, 20]);
  });

  it("saves the age, mode and buddy on the profile and asks them only once", async () => {
    const user = await useLearner();
    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";

    await answerOnboardingQuestion({
      goalId,
      input: { birth: { month: 3, year: 1990 }, question: "age" },
    });

    await answerOnboardingQuestion({ goalId, input: { experienceMode: "fun", question: "mode" } });

    await answerOnboardingQuestion({
      goalId,
      input: { buddy: { kind: "otto", name: "Octavia" }, question: "buddy" },
    });

    const profile = await prisma.userLearningProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });

    expect(profile).toMatchObject({
      birthMonth: 3,
      birthYear: 1990,
      buddyKind: "otto",
      buddyName: "Octavia",
      experienceMode: "fun",
    });

    await expect(getSteps(goalId)).resolves.not.toStrictEqual(
      expect.arrayContaining(["age", "mode", "buddy"]),
    );
  });

  it("deletes the account of someone under 13, kindly and completely", async () => {
    const user = await useLearner();
    const [goal] = await createGoal();
    const thisYear = new Date().getUTCFullYear();

    const result = await answerOnboardingQuestion({
      goalId: goal?.id ?? "",
      input: { birth: { month: 1, year: thisYear - 10 }, question: "age" },
    });

    expect(result).toStrictEqual({ status: "accountDeleted" });
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();
  });

  it("asks a learner's second goal no mode or buddy", async () => {
    const user = await useLearner({ plus: true });
    await goalFixture({ userId: user.id });
    const [goal] = await createGoal([draft({ kind: "exam", title: "Pass the SAT" })]);

    await expect(getSteps(goal?.id ?? "")).resolves.toStrictEqual([
      "target",
      "level",
      "schedule",
      "age",
      "placement",
      "plan",
    ]);
  });

  it("marks a minor, so the guardian invite is offered", async () => {
    const user = await useLearner();
    const thisYear = new Date().getUTCFullYear();

    await prisma.userLearningProfile.create({
      data: { birthMonth: 1, birthYear: thisYear - 15, userId: user.id },
    });

    const [goal] = await createGoal();
    const result = await getOnboarding({ goalId: goal?.id ?? "" });

    expect(result).toMatchObject({ onboarding: { isMinor: true }, status: "ready" });
    expect(result.status === "ready" && result.onboarding.steps).not.toContain("age");
    expect(result.status === "ready" && result.onboarding.steps).toContain("buddy");
  });

  it("keeps other learners' goals private", async () => {
    const owner = await userFixture();
    const goal = await goalFixture({ userId: owner.id });
    await useLearner();

    await expect(getOnboarding({ goalId: goal.id })).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { purpose: "deep", question: "purpose" },
      }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);

    await expect(getOnboarding({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});
