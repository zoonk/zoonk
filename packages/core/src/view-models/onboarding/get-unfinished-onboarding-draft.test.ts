import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag, revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getGoalsCacheTag } from "../../cache/tags";
import { getUnfinishedOnboardingDraft } from "./get-unfinished-onboarding-draft";
import { startGoalUnderstanding } from "./start-goal-understanding";

async function signedInGuest() {
  const user = await userFixture();
  mockGuestSession(user.id);
  return user;
}

const past = () => new Date(Date.now() - 60_000);

/** `next dev` keeps a private read's answer until a write expires one of the tags it carries. */
function readLikeNextDev() {
  let kept: { answer: Awaited<ReturnType<typeof getUnfinishedOnboardingDraft>>; tags: string[] };
  let expired = new Set<string>();

  vi.mocked(revalidateTag).mockImplementation((tag) => {
    expired.add(tag);
  });

  return async () => {
    if (kept && !kept.tags.some((tag) => expired.has(tag))) {
      return kept.answer;
    }

    vi.mocked(cacheTag).mockClear();
    expired = new Set();
    const answer = await getUnfinishedOnboardingDraft();
    kept = { answer, tags: vi.mocked(cacheTag).mock.calls.flat() };
    return answer;
  };
}

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

  it("offers the card the learner just typed, even after an earlier read", async () => {
    const user = await signedInGuest();
    const older = await onboardingDraftFixture({ prompt: "learn Spanish", userId: user.id });
    await prisma.onboardingDraft.update({ data: { updatedAt: past() }, where: { id: older.id } });
    const read = readLikeNextDev();

    await expect(read()).resolves.toMatchObject({ draftId: older.id });

    const started = await startGoalUnderstanding({ goal: "learn Korean", language: "en" });
    expect(started.status).toBe("understanding");

    await expect(read()).resolves.toMatchObject({ prompt: "learn Korean" });
  });
});
