import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import {
  completeUnderstandingDraft,
  failUnderstandingDraft,
  recordUnderstandingRun,
} from "./goal-understanding-run";
import { prepareGoalUnderstandingRun } from "./prepare-goal-understanding-run";
import { reviseOnboardingDraft } from "./revise-onboarding-draft";
import { startGoalUnderstanding } from "./start-goal-understanding";

const PROVENANCE = { model: "test", promptVersion: "test", runId: "test-run" };

async function setup() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  mockSession(user.id);
  return { plan, user };
}

describe("onboarding writes", () => {
  it("marks a new draft separately from its already marked usage claim", async () => {
    const { plan } = await setup();

    await expect(
      startGoalUnderstanding({ goal: `Welding ${randomUUID()}`, language: "en" }),
    ).resolves.toMatchObject({ status: "understanding" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });
  });

  it("marks cached draft creation and completion once each without a usage claim", async () => {
    const { user } = await setup();
    const prompt = `Violin ${randomUUID()}`;

    await goalUnderstandingFixture({
      goal: prompt,
      result: { instrument: "violin", route: "instrument" },
      userId: user.id,
    });

    await expect(startGoalUnderstanding({ goal: prompt, language: "en" })).resolves.toMatchObject({
      status: "understood",
    });
  });

  it("marks a failed draft reset, with no bump when preparing an already ready draft", async () => {
    const { user } = await setup();

    const draft = await onboardingDraftFixture({
      prompt: randomUUID(),
      status: "failed",
      userId: user.id,
    });

    await expect(prepareGoalUnderstandingRun({ draftId: draft.id })).resolves.toMatchObject({
      status: "start",
    });

    await prepareGoalUnderstandingRun({ draftId: draft.id });
  });

  it("saves a revised card once and nothing for equal or invalid edits and refusals", async () => {
    const { user } = await setup();
    const draft = await onboardingDraftFixture({ userId: user.id });
    const edit = { field: "studyTime", value: "20:00" } as const;

    await expect(reviseOnboardingDraft({ draftId: draft.id, edit })).resolves.toMatchObject({
      status: "revised",
    });

    await reviseOnboardingDraft({ draftId: draft.id, edit });

    await expect(
      reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "title", goal: 99, value: "Missing" },
      }),
    ).resolves.toMatchObject({ status: "invalid" });

    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(reviseOnboardingDraft({ draftId: draft.id, edit })).resolves.toMatchObject({
      status: "notFound",
    });

    await expect(prepareGoalUnderstandingRun({ draftId: draft.id })).resolves.toMatchObject({
      status: "notFound",
    });

    mockSession(null);

    await expect(
      startGoalUnderstanding({ goal: "Physics", language: "en" }),
    ).resolves.toMatchObject({ status: "unauthorized" });
  });

  it.each(["reset", "run", "fail", "complete", "revise"] as const)(
    "takes the marker before draft rows for concurrent %s writes",
    async (kind) => {
      const { user } = await setup();

      const draft = await onboardingDraftFixture({
        prompt: randomUUID(),
        status: (
          {
            complete: "understanding",
            fail: "understanding",
            reset: "failed",
            revise: "understood",
            run: "understanding",
          } as const
        )[kind],
        userId: user.id,
      });

      const write = () => {
        switch (kind) {
          case "reset":
            return prepareGoalUnderstandingRun({ draftId: draft.id });
          case "run":
            return recordUnderstandingRun({ draftId: draft.id, runId: "run-race" });
          case "fail":
            return failUnderstandingDraft(draft.id);
          case "complete":
            return completeUnderstandingDraft({
              draft,
              provenance: PROVENANCE,
              result: { route: "unsafe" },
            });
          case "revise":
            return reviseOnboardingDraft({
              draftId: draft.id,
              edit: { field: "studyTime", value: "20:00" },
            });
          default:
            throw new Error("Unexpected onboarding writer");
        }
      };

      const holder = holdLearnerLock({
        beforeCommit: (tx) =>
          tx.$queryRaw`SELECT id FROM onboarding_drafts WHERE id = ${draft.id}::uuid FOR UPDATE`,
        userId: user.id,
      });

      const pid = await holder.pid;
      const writes = Promise.all([write(), write()]);

      try {
        await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
      } finally {
        holder.release();
        await Promise.all([holder.done, writes]);
      }

      await expect(writes).resolves.toHaveLength(2);
    },
  );

  it("takes the marker before inserting a cached draft", async () => {
    const { user } = await setup();
    const prompt = randomUUID();
    await goalUnderstandingFixture({ goal: prompt, result: { route: "unsafe" }, userId: user.id });
    const holder = holdLearnerLock({ userId: user.id });
    const pid = await holder.pid;
    const start = startGoalUnderstanding({ goal: prompt, language: "en" });

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
      await expect(prisma.onboardingDraft.count({ where: { userId: user.id } })).resolves.toBe(0);
    } finally {
      holder.release();
      await Promise.all([holder.done, start]);
    }
  });

  it("keeps both concurrent card edits when they started with the same draft", async () => {
    const { user } = await setup();
    const draft = await onboardingDraftFixture({ userId: user.id });
    const holder = holdLearnerLock({ userId: user.id });
    const pid = await holder.pid;

    const edits = Promise.all([
      reviseOnboardingDraft({ draftId: draft.id, edit: { field: "studyTime", value: "20:00" } }),
      reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "title", goal: 0, value: "Physics at work" },
      }),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      holder.release();
      await Promise.all([holder.done, edits]);
    }

    await expect(edits).resolves.toMatchObject([{ status: "revised" }, { status: "revised" }]);

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({
      understanding: {
        goals: [{ draft: { title: "Physics at work" } }],
        schedule: { studyTime: "20:00" },
      },
    });
  });

  it("keeps a completed draft when a failed reset was waiting for the marker", async () => {
    const { user } = await setup();

    const draft = await onboardingDraftFixture({
      prompt: randomUUID(),
      status: "failed",
      userId: user.id,
    });

    const holder = holdLearnerLock({
      beforeCommit: (tx) =>
        tx.onboardingDraft.update({
          data: { status: "understood", understanding: { status: "unsafe" } },
          where: { id: draft.id },
        }),
      userId: user.id,
    });

    const pid = await holder.pid;
    const reset = prepareGoalUnderstandingRun({ draftId: draft.id });

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      holder.release();
      await Promise.all([holder.done, reset]);
    }

    await expect(reset).resolves.toMatchObject({
      draft: { status: "understood" },
      status: "understood",
    });
  });
});
