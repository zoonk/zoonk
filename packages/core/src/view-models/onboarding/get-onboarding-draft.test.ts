import { randomUUID } from "node:crypto";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getOnboardingDraft } from "./get-onboarding-draft";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

describe(getOnboardingDraft, () => {
  it("needs a session", async () => {
    mockSession(null);

    await expect(getOnboardingDraft({ draftId: randomUUID() })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("shows a draft being read with the run to follow", async () => {
    const user = await userFixture();
    mockGuestSession(user.id);

    const draft = await onboardingDraftFixture({
      prompt: "pass the bar exam",
      runId: "understanding-run",
      status: "understanding",
      userId: user.id,
    });

    await expect(getOnboardingDraft({ draftId: draft.id })).resolves.toStrictEqual({
      draft: {
        generationId: "understanding-run",
        goalId: null,
        id: draft.id,
        prompt: "pass the bar exam",
        status: "understanding",
        understanding: null,
      },
      status: "ready",
    });
  });

  it("shows the card once understood, and the goal confirmed from it", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const draft = await onboardingDraftFixture({ userId: user.id });

    const [archived, goal] = await Promise.all([
      goalFixture({ details: { onboardingId: draft.id }, status: "archived", userId: user.id }),
      goalFixture({ details: { onboardingId: draft.id }, userId: user.id }),
      goalFixture({ details: { onboardingId: randomUUID() }, userId: user.id }),
    ]);

    const result = await getOnboardingDraft({ draftId: draft.id });
    const understanding = result.status === "ready" ? result.draft.understanding : null;

    expect(result.status === "ready" && result.draft.goalId).toBe(goal.id);
    expect(result.status === "ready" && result.draft.goalId).not.toBe(archived.id);
    expect(understanding?.status).toBe("goals");
  });

  it("reads another learner's draft, or a malformed id, as missing", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const draft = await onboardingDraftFixture({ userId: owner.id });
    mockSession(other.id);

    await expect(getOnboardingDraft({ draftId: draft.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getOnboardingDraft({ draftId: "not-a-draft" })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("reads again a card this version can't read, like a failed one", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const draft = await onboardingDraftFixture({
      understanding: { goals: [], status: "goals" },
      userId: user.id,
    });

    const result = await getOnboardingDraft({ draftId: draft.id });

    expect(result.status === "ready" && result.draft).toMatchObject({
      status: "failed",
      understanding: null,
    });
  });
});
