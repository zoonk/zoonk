import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { prepareGoalUnderstandingRun } from "./prepare-goal-understanding-run";

function countAssists(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "assist", userId } });
}

describe(prepareGoalUnderstandingRun, () => {
  it("starts a new draft's first run without counting it again", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const draft = await onboardingDraftFixture({
      prompt: `learn welding ${randomUUID()}`,
      status: "understanding",
      userId: user.id,
    });

    const result = await prepareGoalUnderstandingRun({ draftId: draft.id });

    expect(result.status === "start" && result.draft.status).toBe("understanding");
    await expect(countAssists(user.id)).resolves.toBe(0);
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

    await expect(countAssists(user.id)).resolves.toBe(1);
    expect(result.status === "start" && result.draft.status).toBe("understanding");

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({ status: "understanding" });
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

  it("reads nothing for a guest whose one goal is taken", async () => {
    const guest = await userFixture();
    mockGuestSession(guest.id);
    await usageRecordsFixture({ count: 1, createdAt: new Date(), kind: "goal", userId: guest.id });

    const draft = await onboardingDraftFixture({
      prompt: `learn welding ${randomUUID()}`,
      status: "understanding",
      userId: guest.id,
    });

    await expect(prepareGoalUnderstandingRun({ draftId: draft.id })).resolves.toStrictEqual({
      limit: { limit: 1, period: "total", resource: "goal", tier: "guest" },
      status: "limitReached",
    });
  });

  it("needs no run when the same words were understood today, or the draft already is", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const prompt = `play the violin ${randomUUID()}`;

    await goalUnderstandingFixture({
      goal: prompt,
      result: { instrument: "violin", route: "instrument" },
      userId: user.id,
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
    await expect(countAssists(user.id)).resolves.toBe(0);
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
