import { randomUUID } from "node:crypto";
import { classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { understandGoal as runUnderstandGoal } from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { buildExamIdentityKey } from "../../library/exams/exam-identity";
import { startGoalUnderstanding } from "./start-goal-understanding";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** Model calls are the external boundary; saving a draft must never call them. */
vi.mock("@zoonk/ai/tasks/v2/goals/understand-goal", () => ({ understandGoal: vi.fn() }));
vi.mock("@zoonk/ai/tasks/courses/intent", () => ({ classifyCourseIntent: vi.fn() }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

function uniqueGoal(text: string) {
  return `${text} ${randomUUID()}`;
}

describe(startGoalUnderstanding, () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("needs a session, which guests have", async () => {
    mockSession(null);

    await expect(
      startGoalUnderstanding({ goal: "quantum physics", language: "en" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("understands words read today at once and keeps the card on the learner's draft", async () => {
    const user = await userFixture();
    mockGuestSession(user.id);
    const goal = uniqueGoal("i want to understand quantum physics for work, 20 min a day");

    await goalUnderstandingFixture({
      goal,
      result: {
        dailyMinutes: 20,
        followUps: ["Which part of your job uses it?"],
        goals: [
          {
            kind: "learn",
            level: "I studied it in college",
            ownLevel: "intermediate",
            purpose: "work",
            subject: "Quantum physics",
            title: "Understand quantum physics",
          },
        ],
        route: "goals",
        studyTimeNote: "After work",
      },
    });

    const result = await startGoalUnderstanding({
      goal,
      language: "en",
      timeZone: "America/Sao_Paulo",
    });

    expect(runUnderstandGoal).not.toHaveBeenCalled();
    expect(isRateLimited).not.toHaveBeenCalled();
    expect(result.status).toBe("understood");

    const draft = result.status === "understood" ? result.draft : null;

    expect(draft).toMatchObject({
      generationId: null,
      goalId: null,
      prompt: goal,
      status: "understood",
    });

    const understanding = draft?.understanding;

    if (understanding?.status !== "goals") {
      throw new Error("Expected goals");
    }

    expect(understanding.schedule).toStrictEqual({
      dailyMinutes: 20,
      studyDays: null,
      studyTime: null,
      studyTimeNote: "After work",
    });

    expect(understanding.goals[0]?.draft.details).toStrictEqual({
      answered: ["schedule"],
      followUps: [{ answer: null, question: "Which part of your job uses it?" }],
      level: "intermediate",
      levelNote: "I studied it in college",
      onboardingId: draft?.id,
      purpose: "work",
      studyTimeNote: "After work",
      subject: "Quantum physics",
    });

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft?.id } }),
    ).resolves.toMatchObject({
      language: "en",
      status: "understood",
      timeZone: "America/Sao_Paulo",
      understanding,
      userId: user.id,
    });
  });

  it("gives an exam the dates of the year named, with the notice they came from", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const examName = `Test Exam ${randomUUID()}`;
    const source = await sourceFixture({ title: "Official notice" });
    const citation = { passage: "The exam takes place on", sourceId: source.id };

    const blueprint = await examBlueprintFixture({
      edition: {
        citations: [],
        dates: [
          { citation, date: "2099-11-15", kind: "exam", label: "Day 2" },
          { citation, date: "2099-11-08", kind: "exam", label: "Day 1" },
          { citation, date: "2099-06-01", kind: "registrationEnd", label: "Registration ends" },
        ],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        year: 2099,
      },
      identityKey: buildExamIdentityKey({ name: examName, ownerId: null, role: null }),
      name: examName,
    });

    const goal = uniqueGoal("pass the exam in 2099");

    await goalUnderstandingFixture({
      goal,
      result: {
        followUps: [],
        goals: [{ examName, examYear: 2099, kind: "exam", subject: examName, title: "Pass it" }],
        route: "goals",
      },
    });

    const result = await startGoalUnderstanding({ goal, language: "en" });
    const understanding = result.status === "understood" ? result.draft.understanding : null;
    const [understood] = understanding?.status === "goals" ? understanding.goals : [];
    const official = { title: "Official notice", url: source.url };

    expect(understood?.draft.examBlueprintId).toBe(blueprint.id);

    expect(understood?.examDates).toStrictEqual([
      { date: "2099-11-08", estimated: false, label: "Day 1", source: official },
      { date: "2099-11-15", estimated: false, label: "Day 2", source: official },
    ]);
  });

  it("saves new words as a draft to read in a run, without calling the models here", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const goal = uniqueGoal("learn organic chemistry");

    const result = await startGoalUnderstanding({
      goal,
      language: "pt",
      timeZone: "Europe/Berlin",
    });

    expect(runUnderstandGoal).not.toHaveBeenCalled();
    expect(classifyCourseIntent).not.toHaveBeenCalled();
    expect(isRateLimited).toHaveBeenCalledOnce();

    expect(result).toStrictEqual({
      draft: {
        generationId: null,
        goalId: null,
        id: expect.any(String),
        prompt: goal,
        status: "understanding",
        understanding: null,
      },
      status: "understanding",
    });

    const draftId = result.status === "understanding" ? result.draft.id : "";

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draftId } }),
    ).resolves.toMatchObject({ language: "pt", runId: null, timeZone: "Europe/Berlin" });
  });

  it("slows down a learner who asks too often, before saving anything", async () => {
    const user = await userFixture();
    mockSession(user.id);
    vi.mocked(isRateLimited).mockResolvedValue(true);

    const result = await startGoalUnderstanding({ goal: uniqueGoal("chemistry"), language: "en" });

    expect(result).toStrictEqual({ retryAfterSeconds: expect.any(Number), status: "slowDown" });
    await expect(prisma.onboardingDraft.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("asks a guest who used today's small AI calls to sign up, and still reads words known today", async () => {
    const guest = await useGuestOutOfHelp();
    const known = uniqueGoal("learn to cook rice");

    await goalUnderstandingFixture({
      goal: known,
      result: {
        followUps: [],
        goals: [{ kind: "learn", subject: "Cooking", title: "Cook rice" }],
        route: "goals",
      },
    });

    await expect(
      startGoalUnderstanding({ goal: uniqueGoal("learn welding"), language: "en" }),
    ).resolves.toStrictEqual(GUEST_OUT_OF_HELP);

    await expect(prisma.onboardingDraft.count({ where: { userId: guest.id } })).resolves.toBe(0);

    // Words understood today cost nothing, so the cap doesn't stop them.
    await expect(startGoalUnderstanding({ goal: known, language: "en" })).resolves.toMatchObject({
      status: "understood",
    });
  });
});
