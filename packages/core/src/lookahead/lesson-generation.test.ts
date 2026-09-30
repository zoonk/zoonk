import { randomUUID } from "node:crypto";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  heldBackDraftFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import {
  getLessonGenerationStates,
  releaseStaleLessonClaims,
} from "../library/generation/lesson-generation-state";
import { getLessonWaitingState } from "./get-lesson-waiting-state";
import { requestLessonGeneration } from "./request-lesson-generation";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

async function learnerWithPlan() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });

  const [plan] = await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  return { goal, plan, user };
}

describe(getLessonGenerationStates, () => {
  it("reads each lesson's claim columns as the state waiting screens act on", async () => {
    const lessons = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture({ contentRunId: "run", contentStatus: "running" }),
      libraryLessonFixture({ contentStatus: "pending" }),
      libraryLessonFixture({ contentRunId: "old", contentStatus: "failed" }),
      libraryLessonFixture({
        contentStatus: "failed",
        heldBackDrafts: [heldBackDraftFixture(), heldBackDraftFixture()],
      }),
      libraryLessonFixture({
        contentStatus: "failed",
        heldBackDrafts: [heldBackDraftFixture(), heldBackDraftFixture(), heldBackDraftFixture()],
        setAsideAt: new Date(),
      }),
    ]);

    const states = await getLessonGenerationStates([
      ...lessons.map((lesson) => lesson.id),
      randomUUID(),
    ]);

    expect(lessons.map((lesson) => states.get(lesson.id))).toStrictEqual([
      { status: "ready" },
      { runId: "run", status: "generating" },
      { status: "notStarted" },
      { heldBackDrafts: 0, setAside: false, status: "failed" },
      { heldBackDrafts: 2, setAside: false, status: "failed" },
      { heldBackDrafts: 3, setAside: true, status: "failed" },
    ]);

    // A lesson that no longer exists is left out.
    expect(states.size).toBe(lessons.length);
  });
});

describe(releaseStaleLessonClaims, () => {
  it("frees only the claims the stopped run holds", async () => {
    const [stale, other] = [randomUUID(), randomUUID()];

    const [held, takenOver] = await Promise.all([
      libraryLessonFixture({
        contentRunId: stale,
        contentStatus: "running",
        specRunId: stale,
        specStatus: "running",
      }),
      libraryLessonFixture({ contentRunId: other, contentStatus: "running" }),
    ]);

    await expect(releaseStaleLessonClaims({ lessonId: held.id, staleRunId: stale })).resolves.toBe(
      true,
    );

    await expect(
      releaseStaleLessonClaims({ lessonId: takenOver.id, staleRunId: stale }),
    ).resolves.toBe(false);

    const states = await getLessonGenerationStates([held.id, takenOver.id]);

    expect(states.get(held.id)).toStrictEqual({
      heldBackDrafts: 0,
      setAside: false,
      status: "failed",
    });

    expect(states.get(takenOver.id)).toStrictEqual({ runId: other, status: "generating" });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: held.id } }),
    ).resolves.toMatchObject({ specStatus: "failed" });
  });
});

describe(requestLessonGeneration, () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("needs a session and hides another learner's private lesson", async () => {
    const owner = await userFixture();
    const lesson = await libraryLessonFixture({ ownerId: owner.id, visibility: "private" });

    mockSession(null);

    await expect(requestLessonGeneration({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(requestLessonGeneration({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("answers ready, or the run already writing the lesson so a second request follows it", async () => {
    const runId = randomUUID();

    const [written, writing, user] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture({ contentRunId: runId, contentStatus: "running" }),
      userFixture(),
    ]);

    mockSession(user.id);

    await expect(requestLessonGeneration({ lessonId: written.id })).resolves.toStrictEqual({
      status: "ready",
    });

    await expect(requestLessonGeneration({ lessonId: writing.id })).resolves.toStrictEqual({
      generationId: runId,
      status: "generating",
    });
  });

  it("drafts a held-back lesson again, but never one set aside after its last draft, and charges no lesson start", async () => {
    const [heldBack, setAside, user] = await Promise.all([
      libraryLessonFixture({ contentStatus: "failed", heldBackDrafts: [heldBackDraftFixture()] }),
      libraryLessonFixture({
        contentStatus: "failed",
        heldBackDrafts: [heldBackDraftFixture(), heldBackDraftFixture(), heldBackDraftFixture()],
        setAsideAt: new Date(),
      }),
      userFixture(),
    ]);

    mockSession(user.id);

    await expect(requestLessonGeneration({ lessonId: setAside.id })).resolves.toStrictEqual({
      status: "setAside",
    });

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(requestLessonGeneration({ lessonId: heldBack.id })).resolves.toMatchObject({
      lessonId: heldBack.id,
      status: "start",
    });
  });

  it("counts a planned lesson as the lesson start it leads to, for the learner's active goal and client", async () => {
    const { goal, plan, user } = await learnerWithPlan();
    const lesson = await libraryLessonFixture();

    await planItemFixture({ lessonId: lesson.id, planId: plan.id });
    mockSession(user.id);

    vi.mocked(headers).mockResolvedValue(
      new Headers({ "user-agent": "Zoonk/42 CFNetwork/3826.500.111 Darwin/25.0.0" }),
    );

    await expect(requestLessonGeneration({ lessonId: lesson.id })).resolves.toStrictEqual({
      analytics: { distinctId: user.id, goalId: goal.id, platform: "ios" },
      forExam: false,
      lessonId: lesson.id,
      status: "start",
    });

    // Asking again, or starting it once written, never counts it twice.
    await requestLessonGeneration({ lessonId: lesson.id });

    await expect(
      prisma.usageRecord.findMany({
        select: { generated: true, kind: true, targetId: true },
        where: { userId: user.id },
      }),
    ).resolves.toStrictEqual([{ generated: true, kind: "lessonStart", targetId: lesson.id }]);
  });

  it("refuses an account past today's new lessons, planned ones included", async () => {
    const { plan, user } = await learnerWithPlan();
    const lesson = await libraryLessonFixture();

    await Promise.all([
      planItemFixture({ lessonId: lesson.id, planId: plan.id }),
      usageRecordsFixture({ count: 20, createdAt: new Date(), userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(requestLessonGeneration({ lessonId: lesson.id })).resolves.toMatchObject({
      decision: {
        limit: { period: "day", resource: "lessonStart", tier: "free" },
        status: "limitReached",
      },
      status: "refused",
    });
  });

  it("counts every lesson a guest asks for, their plan's included, so one goal can't write its whole plan", async () => {
    const { plan, user: guest } = await learnerWithPlan();
    const [first, second] = await Promise.all([libraryLessonFixture(), libraryLessonFixture()]);

    await Promise.all([
      prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } }),
      planItemFixture({ lessonId: first.id, planId: plan.id, position: 0 }),
      planItemFixture({ lessonId: second.id, planId: plan.id, position: 1 }),
    ]);

    mockGuestSession(guest.id);

    await expect(requestLessonGeneration({ lessonId: first.id })).resolves.toMatchObject({
      status: "start",
    });

    await expect(requestLessonGeneration({ lessonId: second.id })).resolves.toMatchObject({
      decision: { limit: { resource: "generatedLessons", tier: "guest" }, status: "limitReached" },
      status: "refused",
    });

    await expect(
      prisma.usageRecord.findMany({
        select: { generated: true, targetId: true },
        where: { userId: guest.id },
      }),
    ).resolves.toStrictEqual([{ generated: true, targetId: first.id }]);
  });

  it("counts a lesson outside the plan as the lesson start it leads to, and refuses a guest past their one", async () => {
    const [lesson, guest] = await Promise.all([libraryLessonFixture(), userFixture()]);

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    await usageRecordsFixture({ count: 1, generated: true, userId: guest.id });
    mockGuestSession(guest.id);

    const result = await requestLessonGeneration({ lessonId: lesson.id });

    expect(result).toMatchObject({ decision: { status: "limitReached" }, status: "refused" });
  });
});

describe(getLessonWaitingState, () => {
  it("offers the plan's next written lesson instead of a dead end", async () => {
    const { plan, user } = await learnerWithPlan();
    const runId = randomUUID();

    const [waiting, next] = await Promise.all([
      libraryLessonFixture({ contentRunId: runId, contentStatus: "running" }),
      libraryLessonFixture({ contentStatus: "completed", title: "Ready one" }),
    ]);

    await planItemFixture({ lessonId: waiting.id, planId: plan.id, position: 0 });
    await planItemFixture({ lessonId: next.id, planId: plan.id, position: 1 });
    mockSession(user.id);

    await expect(getLessonWaitingState({ lessonId: waiting.id })).resolves.toStrictEqual({
      state: {
        alternative: { kind: "lesson", lessonId: next.id, title: "Ready one" },
        generationId: runId,
        status: "generating",
      },
      status: "ready",
    });
  });

  it("offers due reviews when no other lesson is written, and nothing once the lesson is ready", async () => {
    const { user } = await learnerWithPlan();

    const [waiting, ready, skill] = await Promise.all([
      libraryLessonFixture(),
      libraryLessonFixture({ contentStatus: "completed" }),
      skillFixture(),
    ]);

    await learnerSkillFixture({
      due: new Date(Date.now() - 60_000),
      skillId: skill.id,
      userId: user.id,
    });

    mockSession(user.id);

    await expect(getLessonWaitingState({ lessonId: waiting.id })).resolves.toMatchObject({
      state: {
        alternative: { dueSkills: 1, kind: "review" },
        generationId: null,
        status: "notStarted",
      },
    });

    await expect(getLessonWaitingState({ lessonId: ready.id })).resolves.toStrictEqual({
      state: { alternative: null, generationId: null, status: "ready" },
      status: "ready",
    });
  });
});
