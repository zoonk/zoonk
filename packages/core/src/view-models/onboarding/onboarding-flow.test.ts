import { randomUUID } from "node:crypto";
import { extractMemoryFacts } from "@zoonk/ai/tasks/v2/memory/extraction";
import { gateMemoryFact } from "@zoonk/ai/tasks/v2/memory/gate";
import { reconcileMemoryFact } from "@zoonk/ai/tasks/v2/memory/reconcile";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { guardianLinkFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { normalizeString } from "@zoonk/utils/string";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { type GoalDraft } from "../../goals/goal-contract";
import { recordGoalGeneration } from "../../goals/record-goal-generation";
import { getCurrentUserMemory } from "../../memory/get-current-user-memory";
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

// Memory's extraction, gate and reconciling are paid model calls; their behavior is covered by evals.
vi.mock("@zoonk/ai/tasks/v2/memory/extraction", () => ({ extractMemoryFacts: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/memory/gate", () => ({ gateMemoryFact: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/memory/reconcile", () => ({ reconcileMemoryFact: vi.fn() }));

const MEMORY_PROVENANCE = {
  generatedAt: "2026-10-08T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: "memory-test",
  runId: "run-memory-test",
};

/** Memory finds one fact about the learner's work and keeps it as new. */
function mockWorkFact(statement: string) {
  vi.mocked(extractMemoryFacts).mockResolvedValue({
    data: {
      facts: [
        {
          category: "background",
          evidence: statement,
          expiresOn: null,
          intent: "remember",
          origin: "said",
          statement,
        },
      ],
    },
    provenance: MEMORY_PROVENANCE,
  } as Awaited<ReturnType<typeof extractMemoryFacts>>);

  vi.mocked(gateMemoryFact).mockResolvedValue({ decision: "keep", sensitive: false } as Awaited<
    ReturnType<typeof gateMemoryFact>
  >);

  vi.mocked(reconcileMemoryFact).mockResolvedValue({ decision: { action: "add" } } as Awaited<
    ReturnType<typeof reconcileMemoryFact>
  >);
}

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

  it("learns who an adult is from onboarding once their age turns memory on", async () => {
    const user = await useLearner();
    const flush = runDeferredWork();
    mockWorkFact("Works as a data analyst");

    const [goal] = await createGoal([
      draft({
        details: { onboardingId: randomUUID(), role: "data analyst", subject: "SQL" },
        prompt: "i want to get better at sql for my job",
        title: "Get better at SQL",
      }),
    ]);

    const goalId = goal?.id ?? "";
    expect(goal?.title).toBe("Get better at SQL");

    // Memory starts off while the learner's age is unknown, so nothing is learned yet.
    await answerOnboardingQuestion({
      goalId,
      input: { birth: { month: 3, year: 1990 }, question: "age" },
    });

    await answerOnboardingQuestion({ goalId, input: { dailyMinutes: 15, question: "schedule" } });
    await flush();

    expect(extractMemoryFacts).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        input: expect.stringContaining("role: data analyst"),
        source: "onboarding",
      }),
    );

    await expect(
      prisma.memoryFact.findMany({ select: { statement: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ statement: "Works as a data analyst" }]);
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

  it("lists only what's still missing, then the profile, placement, the time and the plan", async () => {
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
          "age",
          "memory",
          "buddy",
          "placement",
          "schedule",
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

  /*
   * The notice also lists its written tests among its subjects (a "Prova discursiva" grouped under
   * its own test, an essay): those aren't bodies of knowledge a learner already knows well.
   */
  it("lists an exam's knowledge subjects from its stored notice, not its written tests", async () => {
    const user = await useLearner();
    const citation = { passage: "notice", sourceId: randomUUID() };

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
          mock: {
            adaptive: false,
            citations: [],
            order: null,
            scoring: { description: "", method: "raw" },
            sections: [
              {
                day: null,
                kind: "objective",
                minutes: null,
                name: "Objective test",
                questions: 90,
              },
              {
                day: null,
                kind: "written",
                minutes: 180,
                name: "Written test (P3)",
                questions: null,
              },
            ],
            timeLimitMinutes: null,
            totalQuestions: null,
          },
          rules: [],
          subjects: [
            ...["Languages", "Mathematics and its Technologies"].map((name) => ({
              citation,
              name,
              questions: 45,
              shortName: name === "Languages" ? null : "Math",
              topics: [],
              weight: null,
            })),
            {
              citation,
              group: "Written test (P3)",
              name: "Discursive answers",
              questions: null,
              topics: ["Two discursive questions"],
              weight: null,
            },
            { citation, name: "Essay", questions: null, topics: [], weight: null },
          ],
        },
      },
    });

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await expect(getOnboarding({ goalId: goal.id })).resolves.toMatchObject({
      onboarding: {
        examSubjects: [
          { name: "Languages", shortName: null },
          { name: "Mathematics and its Technologies", shortName: "Math" },
        ],
      },
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
      "age",
      "memory",
      "buddy",
      "placement",
      "schedule",
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
        timeZone: "America/Sao_Paulo",
      },
    });

    expect([dated, scheduled]).toStrictEqual([{ status: "saved" }, { status: "saved" }]);

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(saved).toMatchObject({ dailyMinutes: 45, timezone: "America/Sao_Paulo" });
    expect(saved.targetDate?.toISOString().slice(0, 10)).toBe("2099-03-31");
  });

  it("gives weekends their own time: more on Saturday, Sunday off", async () => {
    await useLearner();
    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";

    const scheduled = await answerOnboardingQuestion({
      goalId,
      input: {
        dailyMinutes: 120,
        question: "schedule",
        studyDays: [1, 2, 3, 4, 5, 6],
        weekendMinutes: 240,
      },
    });

    expect(scheduled).toStrictEqual({ status: "saved" });

    const saved = await prisma.goal.findUniqueOrThrow({
      include: { plan: true },
      where: { id: goalId },
    });

    expect(saved.dailyMinutes).toBe(120);

    expect(saved.plan?.settings).toMatchObject({
      weekdayMinutes: [0, 120, 120, 120, 120, 120, 240],
    });
  });

  it("suggests more time a day once the goal's date is close", async () => {
    await useLearner();
    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";
    const inThreeWeeks = new Date(Date.now() + 21 * MS_PER_DAY).toISOString().slice(0, 10);

    const undated = await getOnboarding({ goalId });

    await answerOnboardingQuestion({
      goalId,
      input: { question: "targetDate", targetDate: inThreeWeeks },
    });

    const dated = await getOnboarding({ goalId });

    expect(undated).toMatchObject({ onboarding: { recommendedMinutes: 15 } });
    expect(dated).toMatchObject({ onboarding: { recommendedMinutes: 60 } });
  });

  it("starts a public exam's time question from its own day, at what a big exam takes", async () => {
    const user = await useLearner();
    const inThreeWeeks = new Date(Date.now() + 21 * MS_PER_DAY);

    const blueprint = await examBlueprintFixture({ examDate: inThreeWeeks });

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: null,
      userId: user.id,
    });

    // Three hours a day: a public exam three weeks away isn't a 15-minute habit.
    await expect(getOnboarding({ goalId: goal.id })).resolves.toMatchObject({
      onboarding: { recommendedMinutes: 180 },
    });
  });

  it("starts a class test's time question short, also once its material is read into its own notice", async () => {
    const user = await useLearner();
    const inThreeDays = new Date(Date.now() + 3 * MS_PER_DAY);
    const inTenDays = new Date(Date.now() + 10 * MS_PER_DAY);

    // The learner's notes, read into a notice only they see: no public exam's three hours a day.
    const material = await examBlueprintFixture({ ownerId: user.id, visibility: "private" });

    const [fromMaterial, attached] = await Promise.all([
      goalFixture({
        examBlueprintId: material.id,
        kind: "exam",
        targetDate: inThreeDays,
        userId: user.id,
      }),
      goalFixture({
        details: { materialIntent: "exam" },
        kind: "exam",
        targetDate: inTenDays,
        userId: user.id,
      }),
    ]);

    await expect(getOnboarding({ goalId: fromMaterial.id })).resolves.toMatchObject({
      onboarding: { recommendedMinutes: 45 },
    });

    await expect(getOnboarding({ goalId: attached.id })).resolves.toMatchObject({
      onboarding: { recommendedMinutes: 30 },
    });
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

  it("saves the age and buddy on the profile and asks them only once", async () => {
    const user = await useLearner();
    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";

    await answerOnboardingQuestion({
      goalId,
      input: { birth: { month: 3, year: 1990 }, question: "age" },
    });

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
    });

    await expect(getSteps(goalId)).resolves.not.toStrictEqual(
      expect.arrayContaining(["age", "buddy"]),
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

  it("saves the exam's subjects the learner knows well with their level", async () => {
    await useLearner();
    const [goal] = await createGoal([draft({ kind: "exam", title: "Passar na Câmara" })]);
    const goalId = goal?.id ?? "";

    await answerOnboardingQuestion({
      goalId,
      input: { knownSubjects: ["Língua Portuguesa"], level: null, question: "level" },
    });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(saved.details).toMatchObject({ knownSubjects: ["Língua Portuguesa"] });
    expect(saved.details).not.toHaveProperty("level");
  });

  it("saves a concurso's target as its position, which research and the plan read", async () => {
    await useLearner();

    const [goal] = await createGoal([
      draft({ details: { examTarget: "position" }, kind: "exam", title: "Passar na PF" }),
    ]);

    const goalId = goal?.id ?? "";
    await answerOnboardingQuestion({ goalId, input: { question: "target", target: "Agente" } });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

    expect(saved.details).toMatchObject({ targetPosition: "Agente" });
    await expect(getSteps(goalId)).resolves.not.toContain("target");
  });

  it("asks a learner's second goal no mode or buddy", async () => {
    const user = await useLearner({ plus: true });
    await goalFixture({ userId: user.id });

    const [goal] = await createGoal([
      draft({ details: { examTarget: "score" }, kind: "exam", title: "Pass the SAT" }),
    ]);

    await expect(getSteps(goal?.id ?? "")).resolves.toStrictEqual([
      "target",
      "level",
      "age",
      "memory",
      "placement",
      "schedule",
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

  it("asks a teen once whether memory may personalize lessons, and Not now keeps it off", async () => {
    const user = await useLearner({ plus: true });
    const thisYear = new Date().getUTCFullYear();

    await prisma.userLearningProfile.create({
      data: { birthMonth: 1, birthYear: thisYear - 15, userId: user.id },
    });

    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";

    await expect(getSteps(goalId)).resolves.toStrictEqual(
      expect.arrayContaining(["memory", "buddy"]),
    );

    await expect(
      answerOnboardingQuestion({ goalId, input: { enabled: false, question: "memory" } }),
    ).resolves.toStrictEqual({ status: "saved" });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ memoryEnabled: false });

    await expect(getSteps(goalId)).resolves.not.toContain("memory");

    const [nextGoal] = await createGoal();
    await expect(getSteps(nextGoal?.id ?? "")).resolves.not.toContain("memory");
  });

  it("turns memory on when a learner of unknown age says yes", async () => {
    const user = await useLearner();
    const [goal] = await createGoal();
    const goalId = goal?.id ?? "";

    await answerOnboardingQuestion({ goalId, input: { birth: null, question: "age" } });
    await expect(getSteps(goalId)).resolves.toContain("memory");

    await answerOnboardingQuestion({ goalId, input: { enabled: true, question: "memory" } });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ memoryEnabled: true });

    await expect(getCurrentUserMemory()).resolves.toMatchObject({ enabled: true });
  });

  it("doesn't ask adults, whose memory is already on, or teens whose guardian keeps it off", async () => {
    const [adult, teen] = await Promise.all([userFixture(), userFixture()]);
    const thisYear = new Date().getUTCFullYear();

    await guardianLinkFixture({
      acceptedAt: new Date(),
      memoryOff: true,
      status: "active",
      userId: teen.id,
    });

    await prisma.userLearningProfile.create({
      data: { birthMonth: 1, birthYear: thisYear - 15, userId: teen.id },
    });

    mockSession(adult.id);
    const [adultGoal] = await createGoal();
    const adultGoalId = adultGoal?.id ?? "";

    await answerOnboardingQuestion({
      goalId: adultGoalId,
      input: { birth: { month: 3, year: 1990 }, question: "age" },
    });

    await expect(getSteps(adultGoalId)).resolves.not.toContain("memory");

    mockSession(teen.id);
    const [teenGoal] = await createGoal();
    await expect(getSteps(teenGoal?.id ?? "")).resolves.not.toContain("memory");
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
