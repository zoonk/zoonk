import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getOnboardingResume } from "./get-onboarding-resume";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

/** Every question, the profile screens and placement already behind it: only the plan is left. */
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

/** Makes a row older, since rows created in one test land within the same moment. */
async function age({ id, model }: { id: string; model: "draft" | "goal" }) {
  const past = new Date(Date.now() - 60_000);

  if (model === "goal") {
    await prisma.goal.update({ data: { createdAt: past }, where: { id } });
    return;
  }

  await prisma.onboardingDraft.update({ data: { updatedAt: past }, where: { id } });
}

describe(getOnboardingResume, () => {
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
