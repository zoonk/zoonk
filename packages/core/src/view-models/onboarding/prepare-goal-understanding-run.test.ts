import { randomUUID } from "node:crypto";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { mockSession } from "../../_test-utils/mock-session";
import { prepareGoalUnderstandingRun } from "./prepare-goal-understanding-run";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

describe(prepareGoalUnderstandingRun, () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("starts a new draft's first run without counting it again", async () => {
    const user = await userFixture();
    mockSession(user.id);
    vi.mocked(isRateLimited).mockResolvedValue(true);

    const draft = await onboardingDraftFixture({
      prompt: `learn welding ${randomUUID()}`,
      status: "understanding",
      userId: user.id,
    });

    const result = await prepareGoalUnderstandingRun({ draftId: draft.id });

    expect(result.status === "start" && result.draft.status).toBe("understanding");
    expect(isRateLimited).not.toHaveBeenCalled();
  });

  it("reads a failed draft again, counted against the learner's AI usage", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const draft = await onboardingDraftFixture({
      prompt: `learn welding ${randomUUID()}`,
      runId: "failed-run",
      status: "failed",
      userId: user.id,
    });

    const result = await prepareGoalUnderstandingRun({ draftId: draft.id });

    expect(isRateLimited).toHaveBeenCalledOnce();
    expect(result.status === "start" && result.draft.status).toBe("understanding");

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({ status: "understanding" });
  });

  it("slows down a learner starting runs again too often, leaving the draft failed", async () => {
    const user = await userFixture();
    mockSession(user.id);
    vi.mocked(isRateLimited).mockResolvedValue(true);

    const draft = await onboardingDraftFixture({
      prompt: `learn welding ${randomUUID()}`,
      runId: "failed-run",
      status: "failed",
      userId: user.id,
    });

    await expect(prepareGoalUnderstandingRun({ draftId: draft.id })).resolves.toStrictEqual({
      retryAfterSeconds: expect.any(Number),
      status: "slowDown",
    });

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({ status: "failed" });
  });

  it("asks a guest who used today's small AI calls to sign up before reading a draft again", async () => {
    const guest = await useGuestOutOfHelp();

    const draft = await onboardingDraftFixture({
      prompt: `learn welding ${randomUUID()}`,
      runId: "failed-run",
      status: "failed",
      userId: guest.id,
    });

    await expect(prepareGoalUnderstandingRun({ draftId: draft.id })).resolves.toStrictEqual(
      GUEST_OUT_OF_HELP,
    );

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({ status: "failed" });
  });

  it("needs no run when the same words were understood today, or the draft already is", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const prompt = `play the violin ${randomUUID()}`;

    await goalUnderstandingFixture({
      goal: prompt,
      result: { instrument: "violin", route: "instrument" },
    });

    const [failed, understood] = await Promise.all([
      onboardingDraftFixture({ prompt, runId: "failed-run", status: "failed", userId: user.id }),
      onboardingDraftFixture({ userId: user.id }),
    ]);

    const [fromCache, alreadyUnderstood] = await Promise.all([
      prepareGoalUnderstandingRun({ draftId: failed.id }),
      prepareGoalUnderstandingRun({ draftId: understood.id }),
    ]);

    expect(fromCache.status === "understood" && fromCache.draft).toMatchObject({
      status: "understood",
      understanding: { instrument: "violin", status: "instrument" },
    });

    expect(alreadyUnderstood.status).toBe("understood");
    expect(isRateLimited).not.toHaveBeenCalled();
  });

  it("only starts the learner's own drafts", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const draft = await onboardingDraftFixture({ status: "understanding", userId: owner.id });

    mockSession(other.id);

    await expect(prepareGoalUnderstandingRun({ draftId: draft.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(prepareGoalUnderstandingRun({ draftId: draft.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});
