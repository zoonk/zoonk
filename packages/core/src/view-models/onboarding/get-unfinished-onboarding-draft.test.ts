import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getGoalsCacheTag } from "../../cache/tags";
import { getUnfinishedOnboardingDraft } from "./get-unfinished-onboarding-draft";

async function signedInGuest() {
  const user = await userFixture();
  mockGuestSession(user.id);
  return user;
}

const past = () => new Date(Date.now() - 60_000);

describe(getUnfinishedOnboardingDraft, () => {
  it("has nothing without a session", async () => {
    mockSession(null);
    await expect(getUnfinishedOnboardingDraft()).resolves.toBeNull();
  });

  it("offers back a goal card typed after every goal", async () => {
    const user = await signedInGuest();
    const goal = await goalFixture({ userId: user.id });
    await prisma.goal.update({ data: { createdAt: past() }, where: { id: goal.id } });

    const draft = await onboardingDraftFixture({ prompt: "learn Spanish", userId: user.id });

    await expect(getUnfinishedOnboardingDraft()).resolves.toStrictEqual({
      draftId: draft.id,
      prompt: "learn Spanish",
    });
  });

  it("leaves a card set aside for a newer goal, even an archived one", async () => {
    const user = await signedInGuest();
    const draft = await onboardingDraftFixture({ userId: user.id });
    await prisma.onboardingDraft.update({ data: { updatedAt: past() }, where: { id: draft.id } });

    await goalFixture({ status: "archived", userId: user.id });

    await expect(getUnfinishedOnboardingDraft()).resolves.toBeNull();
  });

  it("expires with the learner's goals, since confirming the card supersedes it", async () => {
    const user = await signedInGuest();
    vi.mocked(cacheTag).mockClear();

    await getUnfinishedOnboardingDraft();

    expect(vi.mocked(cacheTag).mock.calls.flat()).toContain(getGoalsCacheTag(user.id));
  });
});
