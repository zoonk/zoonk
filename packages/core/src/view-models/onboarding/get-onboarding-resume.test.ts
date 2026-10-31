import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { choiceBlueprintFixture } from "../../exams/choices/_test-utils/choice-blueprint";
import { getOnboardingResume } from "./get-onboarding-resume";

const FINISHED_DETAILS = {
  answered: ["targetDate", "schedule", "age", "memory", "buddy"],
  level: "none",
  purpose: "overview",
};

async function signedInGuest() {
  const user = await userFixture();
  mockGuestSession(user.id);
  return user;
}

async function age({ id, model }: { id: string; model: "draft" | "goal" }) {
  const past = new Date(Date.now() - 60_000);

  if (model === "goal") {
    await prisma.goal.update({ data: { createdAt: past }, where: { id } });
    return;
  }

  await prisma.onboardingDraft.update({ data: { updatedAt: past }, where: { id } });
}

describe(getOnboardingResume, () => {
  it("keeps an unanswered exam choice in onboarding even when the default plan is ready", async () => {
    const user = await signedInGuest();
    const blueprint = await choiceBlueprintFixture();

    const goal = await goalFixture({
      details: FINISHED_DETAILS,
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await planFixture({ goalId: goal.id });

    await expect(getOnboardingResume()).resolves.toStrictEqual({
      resume: { goalId: goal.id, kind: "goal", title: goal.title },
      status: "ready",
    });

    await prisma.goal.update({
      data: {
        details: { ...FINISHED_DETAILS, answered: [...FINISHED_DETAILS.answered, "examChoice"] },
      },
      where: { id: goal.id },
    });

    await expect(getOnboardingResume()).resolves.toStrictEqual({
      resume: { kind: "today" },
      status: "ready",
    });
  });

  it("resumes a course's unanswered date with its saved level and pace despite a ready default plan", async () => {
    const user = await signedInGuest();

    const details = {
      answered: ["level"],
      courseStart: { chapterId: null, dailyMinutes: 30 },
      level: "basic",
    };

    const goal = await goalFixture({
      dailyMinutes: 30,
      details,
      kind: "exam",
      targetDate: new Date("2026-11-08T00:00:00Z"),
      userId: user.id,
    });

    await planFixture({ goalId: goal.id });

    await expect(getOnboardingResume()).resolves.toStrictEqual({
      resume: { goalId: goal.id, kind: "goal", title: goal.title },
      status: "ready",
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 30,
      details,
    });
  });

  it("needs a session", async () => {
    mockSession(null);
    await expect(getOnboardingResume()).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("has nothing to continue for a new visitor", async () => {
    await signedInGuest();
    await expect(getOnboardingResume()).resolves.toStrictEqual({ resume: null, status: "ready" });
  });

  it.each(["understanding", "failed", "understood"] as const)(
    "continues a typed goal that's %s and not confirmed yet",
    async (status) => {
      const user = await signedInGuest();

      const draft = await onboardingDraftFixture({
        prompt: "pass the SAT",
        status,
        userId: user.id,
      });

      await expect(getOnboardingResume()).resolves.toStrictEqual({
        resume: { draftId: draft.id, kind: "draft", prompt: "pass the SAT" },
        status: "ready",
      });
    },
  );

  it("doesn't bring back a declined or unclear goal", async () => {
    const user = await signedInGuest();

    await onboardingDraftFixture({ understanding: { status: "unclear" }, userId: user.id });

    await expect(getOnboardingResume()).resolves.toStrictEqual({ resume: null, status: "ready" });
  });

  it("continues a confirmed goal's onboarding, not the draft it came from", async () => {
    const user = await signedInGuest();
    const draft = await onboardingDraftFixture({ userId: user.id });

    const goal = await goalFixture({
      details: { onboardingId: draft.id },
      title: "Understand quantum physics",
      userId: user.id,
    });

    await expect(getOnboardingResume()).resolves.toStrictEqual({
      resume: { goalId: goal.id, kind: "goal", title: "Understand quantum physics" },
      status: "ready",
    });
  });

  it("sends a learner whose onboarding reached the plan to their day", async () => {
    const user = await signedInGuest();
    await goalFixture({ details: FINISHED_DETAILS, userId: user.id });

    await expect(getOnboardingResume()).resolves.toStrictEqual({
      resume: { kind: "today" },
      status: "ready",
    });
  });

  it("keeps the buddy choice in onboarding while the learner uses the default", async () => {
    const user = await signedInGuest();

    const goal = await goalFixture({
      details: {
        ...FINISHED_DETAILS,
        answered: FINISHED_DETAILS.answered.filter((question) => question !== "buddy"),
      },
      userId: user.id,
    });

    await expect(getOnboardingResume()).resolves.toStrictEqual({
      resume: { goalId: goal.id, kind: "goal", title: goal.title },
      status: "ready",
    });
  });

  it("leaves a draft set aside for a newer goal, and continues one typed after it", async () => {
    const user = await signedInGuest();
    const older = await onboardingDraftFixture({ userId: user.id });
    await age({ id: older.id, model: "draft" });

    const goal = await goalFixture({ details: FINISHED_DETAILS, userId: user.id });

    await expect(getOnboardingResume()).resolves.toStrictEqual({
      resume: { kind: "today" },
      status: "ready",
    });

    await age({ id: goal.id, model: "goal" });
    const newer = await onboardingDraftFixture({ prompt: "learn Spanish", userId: user.id });

    await expect(getOnboardingResume()).resolves.toStrictEqual({
      resume: { draftId: newer.id, kind: "draft", prompt: "learn Spanish" },
      status: "ready",
    });
  });

  it("doesn't bring back a draft whose goals were archived when the learner started over", async () => {
    const user = await signedInGuest();
    const draft = await onboardingDraftFixture({ userId: user.id });

    await goalFixture({ details: { onboardingId: draft.id }, status: "archived", userId: user.id });

    await expect(getOnboardingResume()).resolves.toStrictEqual({ resume: null, status: "ready" });
  });
});
