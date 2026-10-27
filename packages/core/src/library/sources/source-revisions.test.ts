import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import { claimUsage } from "../../entitlements/claim-usage";
import { createOnboardingGoals } from "../../view-models/onboarding/create-onboarding-goals";
import {
  answerGoalUploadRequest,
  dismissGoalUploadRequest,
  recordGoalResearchOutcome,
} from "./goal-upload-request";
import { hashDocument } from "./parse-document";
import { registerSourceUpload } from "./register-upload";
import type * as ClaimUsage from "../../entitlements/claim-usage";

// Which of two writers waiting on the learner's lock takes it first is Postgres's to decide, so a
// test pauses an upload right after its usage claim commits to queue a writer behind it.
vi.mock("../../entitlements/claim-usage", async (importOriginal) => {
  const actual = await importOriginal<typeof ClaimUsage>();
  return { ...actual, claimUsage: vi.fn(actual.claimUsage) };
});

async function setup() {
  const user = await userFixture();
  const goal = await goalFixture({ researchUploadReason: "noOfficialSource", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  mockSession(user.id);
  return { goal, plan, user };
}

describe("source writes", () => {
  it("marks an upload answer once and keeps retries, no-source checks and private-source refusals unchanged", async () => {
    const { goal, plan } = await setup();
    const [source, other] = await Promise.all([sourceFixture(), userFixture()]);
    const privateSource = await sourceFixture({ ownerId: other.id, visibility: "private" });

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [privateSource.id] }),
    ).resolves.toMatchObject({ status: "notFound" });

    await answerGoalUploadRequest({ goalId: goal.id });

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [source.id] }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [source.id] }),
    ).resolves.toMatchObject({ status: "noUploadRequest" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });
  });

  it.each([false, true])(
    "marks onboarding source linking only for an unattached source (attached: %s)",
    async (attached) => {
      const { goal, plan, user } = await setup();

      await prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      });

      const source = await sourceFixture();

      const link = await learnerSourceFixture({
        goalId: attached ? goal.id : null,
        sourceId: source.id,
        userId: user.id,
      });

      await expect(
        createOnboardingGoals({
          dailyMinutes: 15,
          goals: [{ kind: "learn", language: "en", prompt: "Physics", title: "Physics" }],
          sourceIds: [source.id],
        }),
      ).resolves.toMatchObject({ status: "created" });
      // Usage, goal creation and selection already have separate markers; only a new source link adds one.

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ inputVersion: plan.inputVersion + 2 });

      const saved = await prisma.learnerSource.findUniqueOrThrow({ where: { id: link.id } });
      expect(saved.goalId === goal.id).toBe(attached);
    },
  );

  it("marks private source creation and linking separately from usage, while a duplicate upload or refusal commits no extra mark", async () => {
    const { plan, user } = await setup();
    const text = `Physics notes ${randomUUID()}`;

    await expect(
      registerSourceUpload({ kind: "text", language: "en", text }),
    ).resolves.toMatchObject({ status: "ready" });

    await registerSourceUpload({ kind: "text", language: "en", text });
    await usageRecordsFixture({ count: 2, kind: "upload", userId: user.id });

    await expect(
      registerSourceUpload({ kind: "text", language: "en", text: randomUUID() }),
    ).resolves.toMatchObject({ status: "limitReached" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });

    await expect(prisma.source.count({ where: { ownerId: user.id } })).resolves.toBe(1);
  });

  it("takes the marker before answering an upload request and rolls back a concurrent loser", async () => {
    const { goal, user } = await setup();
    const sources = await Promise.all([sourceFixture(), sourceFixture()]);

    const holder = holdLearnerLock({
      beforeCommit: (tx) =>
        tx.$queryRaw`SELECT id FROM goals WHERE id = ${goal.id}::uuid FOR UPDATE`,
      userId: user.id,
    });

    const pid = await holder.pid;

    const writes = Promise.all(
      sources.map((source) => answerGoalUploadRequest({ goalId: goal.id, sourceIds: [source.id] })),
    );

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      holder.release();
      await Promise.all([holder.done, writes]);
    }

    await expect(prisma.learnerSource.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it.each(["private", "shared"] as const)(
    "takes a fresh marker after usage before the %s source write",
    async (kind) => {
      const { user } = await setup();
      const text = `Notes ${randomUUID()}`;

      if (kind === "shared") {
        await sourceFixture({
          contentHash: hashDocument({ bytes: new TextEncoder().encode(text), text }),
        });
      }

      const actual = await vi.importActual<typeof ClaimUsage>("../../entitlements/claim-usage");
      const claimed = Promise.withResolvers<null>();
      const resume = Promise.withResolvers<null>();

      vi.mocked(claimUsage).mockImplementationOnce(async (input) => {
        const decision = await actual.claimUsage(input);
        claimed.resolve(null);
        await resume.promise;
        return decision;
      });

      const upload = registerSourceUpload({ kind: "text", language: "en", text });
      await claimed.promise;

      // Another marked writer takes the lock once usage is committed, so the source write has to
      // wait on its own marker.
      const holder = holdLearnerLock({ userId: user.id });

      try {
        const pid = await holder.pid;
        resume.resolve(null);
        await waitForBlockedStatement(pid, LEARNER_LOCK);
        await expect(prisma.source.count({ where: { ownerId: user.id } })).resolves.toBe(0);
        await expect(prisma.learnerSource.count({ where: { userId: user.id } })).resolves.toBe(0);
      } finally {
        resume.resolve(null);
        holder.release();
        await Promise.all([holder.done, upload]);
      }

      await expect(upload).resolves.toMatchObject({ status: "ready" });
    },
  );

  it("marks dismissal once and leaves no-op and refused dismissals unmarked", async () => {
    const { goal, plan } = await setup();
    await dismissGoalUploadRequest({ goalId: goal.id });
    await dismissGoalUploadRequest({ goalId: goal.id });
    const other = await userFixture();
    mockSession(other.id);

    await expect(dismissGoalUploadRequest({ goalId: goal.id })).resolves.toMatchObject({
      status: "notFound",
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });
  });

  it.each(["dismiss", "outcome"] as const)(
    "takes the marker before goal rows and commits one concurrent %s",
    async (kind) => {
      const { goal, user } = await setup();

      const holder = holdLearnerLock({
        beforeCommit: (tx) =>
          tx.$queryRaw`SELECT id FROM goals WHERE id = ${goal.id}::uuid FOR UPDATE`,
        userId: user.id,
      });

      const pid = await holder.pid;

      const write = () =>
        kind === "dismiss"
          ? dismissGoalUploadRequest({ goalId: goal.id })
          : recordGoalResearchOutcome({ goalId: goal.id, uploadReason: "classMaterial" });

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
});
