import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  goalSourceFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it } from "vitest";
import { mergeIntoSharedCopy, uploadWithSharedCopyFixture } from "../../_test-utils/merged-upload";
import { mockSession } from "../../_test-utils/mock-session";
import {
  answerGoalUploadRequest,
  dismissGoalUploadRequest,
  getGoalUploadRequest,
  recordGoalResearchOutcome,
  recordGoalResearchRun,
} from "./goal-upload-request";
import {
  getOwedResearchUploadAnswer,
  getReadableResearchUploadIds,
  reopenResearchUploadAnswer,
} from "./research-upload-answer";

async function privateUploadFixture(ownerId: string, goalId: string | null = null) {
  const contentHash = `hash-${randomUUID()}`;

  const source = await sourceFixture({
    contentHash,
    extractedText: "Biology class notes",
    identityKey: `private:${ownerId}:upload:${contentHash}`,
    kind: "upload",
    ownerId,
    url: null,
    visibility: "private",
  });

  await learnerSourceFixture({ goalId, sourceId: source.id, userId: ownerId });

  return source;
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

async function reopenWithPriorUpload() {
  const { goal, user } = await examGoalWaitingForNotice();
  const first = await privateUploadFixture(user.id, goal.id);
  mockSession(user.id);

  await answerGoalUploadRequest({ goalId: goal.id, sourceIds: [first.id] });
  await recordGoalResearchOutcome({ goalId: goal.id, uploadReason: "unverified" });

  return { first, goal, user };
}

async function uploadPhoto(userId: string, readState: "read" | "owed") {
  const photo = await sourceFixture({
    kind: "upload",
    ownerId: userId,
    readState,
    visibility: "private",
  });

  await learnerSourceFixture({ sourceId: photo.id, userId });
  return photo;
}

function readAnsweredIds(goalId: string) {
  return prisma.goalSource
    .findMany({ select: { sourceId: true }, where: { answeredAt: { not: null }, goalId } })
    .then((links) => links.map((link) => link.sourceId).toSorted());
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
      request: {
        examDocument: "notice",
        goalId: goal.id,
        goalKind: "exam",
        language: "en",
        reason: "noOfficialSource",
        unreadableUpload: null,
      },
      status: "ready",
    });

    await recordGoalResearchOutcome({ goalId: goal.id, uploadReason: null });

    await expect(getGoalUploadRequest({ goalId: goal.id })).resolves.toStrictEqual({
      request: null,
      status: "ready",
    });
  });

  it("uses the latest answer when deciding whether to mention an unreadable upload", async () => {
    const { goal, user } = await examGoalWaitingForNotice();

    const [oldPhoto, recentText] = await Promise.all([
      uploadPhoto(user.id, "read"),
      privateUploadFixture(user.id),
    ]);

    await Promise.all([
      goalSourceFixture({
        answeredAt: new Date("2026-11-24T12:00:00Z"),
        goalId: goal.id,
        sourceId: oldPhoto.id,
      }),
      goalSourceFixture({
        answeredAt: new Date("2026-11-24T12:00:01Z"),
        goalId: goal.id,
        sourceId: recentText.id,
      }),
    ]);

    mockSession(user.id);

    await expect(getGoalUploadRequest({ goalId: goal.id })).resolves.toMatchObject({
      request: { unreadableUpload: null },
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

    const [upload, unlinked] = await Promise.all([
      privateUploadFixture(user.id, goal.id),
      privateUploadFixture(user.id),
    ]);

    mockSession(user.id);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [upload.id, unlinked.id] }),
    ).resolves.toStrictEqual({
      goalId: goal.id,
      researchRunId: null,
      sourceIds: [upload.id, unlinked.id],
      status: "ready",
    });

    await expect(readAnsweredIds(goal.id)).resolves.toStrictEqual(
      [upload.id, unlinked.id].toSorted(),
    );

    await expect(readReason(goal.id)).resolves.toBeNull();
  });

  it("keeps the ask when a source is from the Library, not the learner's upload", async () => {
    const { goal, user } = await examGoalWaitingForNotice();
    const shared = await sourceFixture();
    mockSession(user.id);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [shared.id] }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(readReason(goal.id)).resolves.toBe("noOfficialSource");
    await expect(prisma.learnerSource.count({ where: { sourceId: shared.id } })).resolves.toBe(0);
  });

  it("leaves the request open and records no answer for a settled unreadable source", async () => {
    const { goal, user } = await examGoalWaitingForNotice();

    const photo = await sourceFixture({
      kind: "upload",
      ownerId: user.id,
      readState: "read",
      visibility: "private",
    });

    await learnerSourceFixture({ sourceId: photo.id, userId: user.id });
    mockSession(user.id);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [photo.id] }),
    ).resolves.toStrictEqual({ status: "unreadable" });

    await expect(readReason(goal.id)).resolves.toBe("noOfficialSource");
    await expect(readAnsweredIds(goal.id)).resolves.toStrictEqual([]);
  });

  it("takes each upload once, so research asking again needs a new upload", async () => {
    const { goal, user } = await examGoalWaitingForNotice();
    const first = await privateUploadFixture(user.id, goal.id);
    mockSession(user.id);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [first.id] }),
    ).resolves.toMatchObject({ status: "ready" });

    await recordGoalResearchOutcome({ goalId: goal.id, uploadReason: "unverified" });

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [first.id] }),
    ).resolves.toStrictEqual({ status: "alreadyAnswered" });

    await expect(readReason(goal.id)).resolves.toBe("unverified");

    const second = await privateUploadFixture(user.id, goal.id);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [first.id, second.id] }),
    ).resolves.toMatchObject({ sourceIds: [first.id, second.id], status: "ready" });
  });

  it("keeps a reopened request when only the previously answered upload has text", async () => {
    const { first, goal, user } = await reopenWithPriorUpload();
    const photo = await uploadPhoto(user.id, "read");

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [first.id, photo.id] }),
    ).resolves.toStrictEqual({ status: "unreadable" });

    await expect(readAnsweredIds(goal.id)).resolves.toStrictEqual([first.id]);
    await expect(readReason(goal.id)).resolves.toBe("unverified");
  });

  it("requires newly claimed text after a deferred answer finishes reading", async () => {
    const { first, goal, user } = await reopenWithPriorUpload();
    const photo = await uploadPhoto(user.id, "owed");

    const answer = await answerGoalUploadRequest({
      goalId: goal.id,
      sourceIds: [first.id, photo.id],
    });

    if (answer.status !== "ready" || !answer.pendingUploadAnswer) {
      throw new Error("The answer did not wait for the new photo");
    }

    const pending = await getOwedResearchUploadAnswer(answer.pendingUploadAnswer);

    if (!pending) {
      throw new Error("The pending answer was not recorded");
    }

    expect(pending.claimedSourceIds).toStrictEqual([photo.id]);

    await prisma.source.update({ data: { readState: "read" }, where: { id: photo.id } });
    await expect(getReadableResearchUploadIds(pending)).resolves.toStrictEqual([]);

    await reopenResearchUploadAnswer(pending);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [photo.id] }),
    ).resolves.toStrictEqual({ status: "unreadable" });

    await prisma.source.update({
      data: { extractedText: "New material" },
      where: { id: photo.id },
    });

    await expect(getReadableResearchUploadIds(pending)).resolves.toStrictEqual([
      first.id,
      photo.id,
    ]);
  });

  it("lets one upload answer each goal's ask once", async () => {
    const { goal, user } = await examGoalWaitingForNotice();

    const [other, notice] = await Promise.all([
      goalFixture({ kind: "exam", researchUploadReason: "noOfficialSource", userId: user.id }),
      privateUploadFixture(user.id, goal.id),
    ]);

    mockSession(user.id);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [notice.id] }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      answerGoalUploadRequest({ goalId: other.id, sourceIds: [notice.id] }),
    ).resolves.toMatchObject({ sourceIds: [notice.id], status: "ready" });

    await recordGoalResearchOutcome({ goalId: other.id, uploadReason: "unverified" });

    await expect(
      answerGoalUploadRequest({ goalId: other.id, sourceIds: [notice.id] }),
    ).resolves.toStrictEqual({ status: "alreadyAnswered" });

    await expect(readAnsweredIds(other.id)).resolves.toStrictEqual([notice.id]);
  });

  it("answers with an upload merged into a shared copy since the learner sent it", async () => {
    const { goal, user } = await examGoalWaitingForNotice();
    const { shared, upload } = await uploadWithSharedCopyFixture(user.id);
    await mergeIntoSharedCopy(upload);
    mockSession(user.id);

    await expect(
      answerGoalUploadRequest({ goalId: goal.id, sourceIds: [upload.id] }),
    ).resolves.toMatchObject({ sourceIds: [shared.id], status: "ready" });

    await expect(readAnsweredIds(goal.id)).resolves.toStrictEqual([shared.id]);
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
      prisma.learnerSource.count({ where: { sourceId: othersUpload.id, userId: user.id } }),
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
