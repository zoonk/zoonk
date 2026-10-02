import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import {
  answerGoalUploadRequest,
  dismissGoalUploadRequest,
  getGoalUploadRequest,
  recordGoalResearchOutcome,
  recordGoalResearchRun,
} from "./goal-upload-request";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

function privateUploadFixture(ownerId: string) {
  const contentHash = `hash-${randomUUID()}`;

  return sourceFixture({
    contentHash,
    identityKey: `private:${ownerId}:upload:${contentHash}`,
    kind: "upload",
    ownerId,
    url: null,
    visibility: "private",
  });
}

async function examGoalWaitingForNotice() {
  const user = await userFixture();

  const goal = await goalFixture({
    kind: "exam",
    researchUploadReason: "noOfficialSource",
    userId: user.id,
  });

  return { goal, user };
}

function readReason(goalId: string) {
  return prisma.goal
    .findUniqueOrThrow({ select: { researchUploadReason: true }, where: { id: goalId } })
    .then((goal) => goal.researchUploadReason);
}

describe(getGoalUploadRequest, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns what research asked the learner to upload, and nothing once it needs nothing", async () => {
    const { goal, user } = await examGoalWaitingForNotice();
    mockSession(user.id);

    await expect(getGoalUploadRequest({ goalId: goal.id })).resolves.toStrictEqual({
      request: { goalId: goal.id, goalKind: "exam", language: "en", reason: "noOfficialSource" },
      status: "ready",
    });

    await recordGoalResearchOutcome({ goalId: goal.id, uploadReason: null });

    await expect(getGoalUploadRequest({ goalId: goal.id })).resolves.toStrictEqual({
      request: null,
      status: "ready",
    });
  });

  it("never shows another learner's ask", async () => {
    const [{ goal }, other] = await Promise.all([examGoalWaitingForNotice(), userFixture()]);

    await expect(getGoalUploadRequest({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    mockSession(other.id);

    await expect(getGoalUploadRequest({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(dismissGoalUploadRequest({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(readReason(goal.id)).resolves.toBe("noOfficialSource");
  });
});

describe(dismissGoalUploadRequest, () => {
  it("takes the ask off the learner's goal", async () => {
    const { goal, user } = await examGoalWaitingForNotice();
    mockSession(user.id);

    await expect(dismissGoalUploadRequest({ goalId: goal.id })).resolves.toStrictEqual({
      status: "dismissed",
    });

    await expect(readReason(goal.id)).resolves.toBeNull();
  });
});

describe(answerGoalUploadRequest, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("links the learner's uploads to the goal and clears the ask at once", async () => {
    const { goal, user } = await examGoalWaitingForNotice();

    const [upload, linkedElsewhere, shared] = await Promise.all([
      privateUploadFixture(user.id),
      privateUploadFixture(user.id),
      sourceFixture(),
    ]);

    // The upload route already linked this one to the learner, without a goal.
    await learnerSourceFixture({ sourceId: linkedElsewhere.id, userId: user.id });
    mockSession(user.id);

    await expect(
      answerGoalUploadRequest({
        goalId: goal.id,
        sourceIds: [upload.id, linkedElsewhere.id, shared.id],
      }),
    ).resolves.toStrictEqual({
      goalId: goal.id,
      researchRunId: null,
      sourceIds: [upload.id, linkedElsewhere.id, shared.id],
      status: "ready",
    });

    const links = await prisma.learnerSource.findMany({
      select: { goalId: true, origin: true, sourceId: true },
      where: { userId: user.id },
    });

    expect(links).toHaveLength(3);
    expect(links.every((link) => link.goalId === goal.id && link.origin === "upload")).toBe(true);
    await expect(readReason(goal.id)).resolves.toBeNull();
  });

  it("keeps the ask when an upload isn't the learner's", async () => {
    const [{ goal, user }, other] = await Promise.all([examGoalWaitingForNotice(), userFixture()]);
    const othersUpload = await privateUploadFixture(other.id);
    mockSession(user.id);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [othersUpload.id] }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(readReason(goal.id)).resolves.toBe("noOfficialSource");

    await expect(
      prisma.learnerSource.count({ where: { sourceId: othersUpload.id } }),
    ).resolves.toBe(0);
  });

  it("answers an ask once, so uploads can't rebuild the goal over and over", async () => {
    const { goal, user } = await examGoalWaitingForNotice();

    const [first, second] = await Promise.all([
      privateUploadFixture(user.id),
      privateUploadFixture(user.id),
    ]);

    mockSession(user.id);

    const answers = await Promise.all([
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [first.id] }),
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [second.id] }),
    ]);

    expect(answers.map((answer) => answer.status).toSorted()).toStrictEqual([
      "noUploadRequest",
      "ready",
    ]);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [first.id] }),
    ).resolves.toStrictEqual({ status: "noUploadRequest" });
  });

  it("only checks access when research starts without uploads, and names the last run", async () => {
    const { goal, user } = await examGoalWaitingForNotice();
    mockSession(user.id);

    await expect(answerGoalUploadRequest({ goalId: goal.id })).resolves.toStrictEqual({
      goalId: goal.id,
      researchRunId: null,
      sourceIds: [],
      status: "ready",
    });

    await recordGoalResearchRun({ goalId: goal.id, runId: "wrun_research" });

    await expect(answerGoalUploadRequest({ goalId: goal.id })).resolves.toMatchObject({
      researchRunId: "wrun_research",
    });

    await expect(readReason(goal.id)).resolves.toBe("noOfficialSource");
  });
});

describe(recordGoalResearchOutcome, () => {
  it("sets the reason research asks for, and skips a goal deleted meanwhile", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "exam", userId: user.id });

    await recordGoalResearchOutcome({ goalId: goal.id, uploadReason: "classMaterial" });
    await expect(readReason(goal.id)).resolves.toBe("classMaterial");

    await expect(
      recordGoalResearchOutcome({ goalId: randomUUID(), uploadReason: "unverified" }),
    ).resolves.toBeUndefined();
  });
});
