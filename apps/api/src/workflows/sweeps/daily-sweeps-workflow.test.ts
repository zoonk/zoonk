import { randomUUID } from "node:crypto";
import { recordSourceChangeNotice } from "@zoonk/core/library/sources/notices";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { evaluationRunFixture } from "@zoonk/testing/fixtures/evaluation-runs";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  examBlueprintFixture,
  sourceFixture,
  unnoticedSourceChangeFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assert, describe, expect, it } from "vitest";
import { start } from "workflow/api";
import { mockHookConflict } from "../../../mocks/workflow";
import { getStartMock } from "../_test-utils/start-mock";
import { followUpsWorkflow } from "../follow-ups/follow-ups-workflow";
import { freshnessWorkflow } from "../freshness/freshness-workflow";
import { pictureChecksWorkflow } from "../images/picture-checks-workflow";
import { sentenceOrdersWorkflow } from "../language/sentence-orders-workflow";
import { courseReleaseWorkflow } from "../products/course-release-workflow";
import { laterReviewWorkflow } from "../quality/later-review-workflow";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import { dailySweepsWorkflow } from "./daily-sweeps-workflow";

const DAY_MS = 86_400_000;
const LEARNERS_TO_RECALIBRATE = 20;

function scheduledRun() {
  return { executionId: randomUUID() };
}

function verificationFixture(expiresAt: Date) {
  return prisma.verification.create({
    data: { expiresAt, identifier: `sign-in-otp-${randomUUID()}@zoonk.test`, value: "123456:0" },
  });
}

async function missedQuestionFixture() {
  const [skill, learner] = await Promise.all([skillFixture(), userFixture()]);
  const item = await itemFixture({ difficulty: 0, skillId: skill.id });

  await Promise.all([
    attemptFixture({ isCorrect: false, itemId: item.id, userId: learner.id }),
    prisma.anonymousFirstAnswer.createMany({
      data: Array.from({ length: LEARNERS_TO_RECALIBRATE - 1 }, () => ({
        isCorrect: false,
        itemId: item.id,
      })),
    }),
  ]);

  return item;
}

describe(dailySweepsWorkflow, () => {
  it("checks due exams and sources, deletes inactive guests, purges old memory and evaluation runs, recalibrates questions, starts the later check of lessons made ahead, deletes lesson versions replaced days ago and sign-in codes expired days ago", async () => {
    const now = Date.now();

    const [guest, learner, exam] = await Promise.all([
      userFixture(),
      userFixture(),
      // The sweep takes the latest due first, so other tests' due exams can't push this one out of
      // its batch.
      examBlueprintFixture({ nextCheckAt: new Date(now + DAY_MS - 60_000) }),
    ]);

    await prisma.user.update({
      data: { createdAt: new Date(now - 60 * DAY_MS), isAnonymous: true },
      where: { id: guest.id },
    });

    const [lesson, oldCode, expiredCode] = await Promise.all([
      // Ids ending this way land in the later review's one-in-five sample.
      libraryLessonFixture({
        contentStatus: "completed",
        id: `${randomUUID().slice(0, -8)}0000000a`,
      }),
      verificationFixture(new Date(now - 2 * DAY_MS)),
      verificationFixture(new Date(now - 60_000)),
      memoryFactFixture({
        deletedAt: new Date(now - 40 * DAY_MS),
        status: "deleted",
        userId: learner.id,
      }),
      missedQuestionFixture(),
      evaluationRunFixture({ createdAt: new Date(now - 31 * DAY_MS) }),
      libraryLessonFixture({ contentStatus: "completed" }).then((replacedIn) =>
        libraryStepFixture({
          lessonId: replacedIn.id,
          position: 0,
          retiredAt: new Date(now - 2 * DAY_MS),
        }),
      ),
    ]);

    const [expiredSession, oldAccessRecord] = await Promise.all([
      prisma.session.create({
        data: { expiresAt: new Date(now - DAY_MS), token: randomUUID(), userId: learner.id },
      }),
      prisma.accessRecord.create({
        data: {
          createdAt: new Date(now - 200 * DAY_MS),
          id: randomUUID(),
          ipAddress: "203.0.113.1",
          userId: learner.id,
        },
      }),
    ]);

    const result = await dailySweepsWorkflow(scheduledRun());
    assert(result.status === "swept");

    expect(result.sessionsPurged).toBeGreaterThanOrEqual(1);
    expect(result.accessRecordsPurged).toBeGreaterThanOrEqual(1);

    await expect(
      prisma.session.findUnique({ where: { id: expiredSession.id } }),
    ).resolves.toBeNull();

    await expect(
      prisma.accessRecord.findUnique({ where: { id: oldAccessRecord.id } }),
    ).resolves.toBeNull();

    expect(result.guestsDeleted).toBeGreaterThanOrEqual(1);
    expect(result.memoryFactsPurged).toBeGreaterThanOrEqual(1);
    expect(result.itemsRecalibrated).toBeGreaterThanOrEqual(1);
    expect(result.evaluationRunsPurged).toBeGreaterThanOrEqual(1);
    expect(result.retiredStepsDeleted).toBeGreaterThanOrEqual(1);
    expect(result.verificationsPurged).toBeGreaterThanOrEqual(1);

    await expect(
      Promise.all([
        prisma.verification.findUnique({ where: { id: oldCode.id } }),
        prisma.verification.findUnique({ where: { id: expiredCode.id } }),
      ]),
    ).resolves.toStrictEqual([null, expect.objectContaining({ id: expiredCode.id })]);

    expect(start).toHaveBeenCalledWith(
      freshnessWorkflow,
      [{ examBlueprintId: exam.id, kind: "exam" }],
      { experimental_hook: { token: `freshness:exam:${exam.id}` } },
    );

    expect(result.freshnessChecks).toBeGreaterThanOrEqual(1);

    const reviewed = getStartMock()
      .mock.calls.filter(([workflow]) => workflow === laterReviewWorkflow)
      .flatMap(([, args]) => (args as [{ lessonIds: string[] }])[0].lessonIds);

    expect(reviewed).toContain(lesson.id);
    expect(result.laterReviews).toBe(reviewed.length);
  });

  it("starts the follow-ups of learners whose owed work no run took", async () => {
    const [waiting, recent] = await Promise.all([userFixture(), userFixture()]);

    await prisma.followUp.createMany({
      data: [
        {
          input: { language: "en" },
          key: "en",
          kind: "findMistakePattern",
          requestedAt: new Date(Date.now() - DAY_MS),
          userId: waiting.id,
        },
        { input: { language: "en" }, key: "en", kind: "findMistakePattern", userId: recent.id },
      ],
    });

    const result = await dailySweepsWorkflow(scheduledRun());
    assert(result.status === "swept");

    expect(start).toHaveBeenCalledWith(followUpsWorkflow, [{ userId: waiting.id }], {
      experimental_hook: { token: `follow-ups:${waiting.id}` },
    });

    expect(start).not.toHaveBeenCalledWith(
      followUpsWorkflow,
      [{ userId: recent.id }],
      expect.anything(),
    );

    expect(result.followUpsStarted).toBeGreaterThanOrEqual(1);
  });

  it("starts the update of a followed course its product's announced release, now out, left behind", async () => {
    const brand = await brandFixture();
    const product = await productFixture({ organizationId: brand.id });

    const [taught] = await Promise.all([
      productReleaseFixture({
        productId: product.id,
        releasedAt: new Date(Date.now() - 400 * DAY_MS),
      }),
      productReleaseFixture({ productId: product.id, releasedAt: new Date(Date.now() - DAY_MS) }),
    ]);

    const course = await courseFixture({
      organizationId: brand.id,
      productId: product.id,
      productReleaseId: taught.id,
    });

    const user = await userFixture();
    await goalFixture({ primaryCourseId: course.id, userId: user.id });

    await dailySweepsWorkflow(scheduledRun());

    expect(start).toHaveBeenCalledWith(courseReleaseWorkflow, [{ courseId: course.id }], {
      experimental_hook: { token: `course-release:${course.id}` },
    });
  });

  it("starts the check of pictures still owing one, such as a picture whose storing step failed before starting it", async () => {
    const [owed, checked] = await Promise.all([
      // The sweep takes the longest-owed first, so other tests' owed pictures can't push this one out
      // of its batch.
      mediaAssetFixture({ checkOwedAt: new Date(Date.now() - 30 * DAY_MS) }),
      mediaAssetFixture({ checkOwedAt: null }),
    ]);

    const result = await dailySweepsWorkflow(scheduledRun());
    assert(result.status === "swept");

    const started = getStartMock()
      .mock.calls.filter(([workflow]) => workflow === pictureChecksWorkflow)
      .flatMap(([, args]) => (args as [{ assetIds: string[] }])[0].assetIds);

    expect(started).toContain(owed.id);
    expect(started).not.toContain(checked.id);
    expect(result.pictureChecks).toBe(started.length);
  });

  it("starts writing the word orders lessons written before them still owe", async () => {
    const [owed, written, failing] = await Promise.all([
      languageLessonFixture(),
      languageLessonFixture(),
      languageLessonFixture(),
    ]);

    await Promise.all([
      prisma.lessonSentence.updateMany({
        data: { ordersOwedAt: new Date(Date.now() - 30 * DAY_MS) },
        where: { lessonId: owed.lesson.id },
      }),
      prisma.lessonSentence.updateMany({
        data: { ordersOwedAt: null },
        where: { lessonId: written.lesson.id },
      }),
      prisma.lesson.update({
        data: { sentenceOrdersAttempts: 8 },
        where: { id: failing.lesson.id },
      }),
    ]);

    const result = await dailySweepsWorkflow(scheduledRun());
    assert(result.status === "swept");

    const started = getStartMock()
      .mock.calls.filter(([workflow]) => workflow === sentenceOrdersWorkflow)
      .flatMap(([, args]) => (args as [{ lessonIds: string[] }])[0].lessonIds);

    expect(started).toContain(owed.lesson.id);
    expect(started).not.toContain(written.lesson.id);
    expect(started).not.toContain(failing.lesson.id);
    expect(result.sentenceOrders).toBe(started.length);
  });

  it("prioritizes the lessons learners played most recently over older debt and unplayed lessons", async () => {
    const [recent, older, unplayed, user] = await Promise.all([
      languageLessonFixture(),
      languageLessonFixture(),
      languageLessonFixture(),
      userFixture(),
    ]);

    const now = Date.now();

    await Promise.all([
      prisma.lessonSentence.updateMany({
        data: { ordersOwedAt: new Date(now - 60 * DAY_MS) },
        where: { lessonId: unplayed.lesson.id },
      }),
      learningEventFixture({
        contentIds: { lessonId: recent.lesson.id },
        endedAt: new Date(now - DAY_MS),
        userId: user.id,
      }),
      learningEventFixture({
        contentIds: { lessonId: recent.lesson.id },
        endedAt: new Date(now - 30 * DAY_MS),
        userId: user.id,
      }),
      learningEventFixture({
        contentIds: { lessonId: older.lesson.id },
        endedAt: new Date(now - 2 * DAY_MS),
        userId: user.id,
      }),
    ]);

    await dailySweepsWorkflow(scheduledRun());

    const started = getStartMock()
      .mock.calls.filter(([workflow]) => workflow === sentenceOrdersWorkflow)
      .flatMap(([, args]) => (args as [{ lessonIds: string[] }])[0].lessonIds)
      .filter((id) => [recent.lesson.id, older.lesson.id, unplayed.lesson.id].includes(id));

    expect(started).toStrictEqual([recent.lesson.id, older.lesson.id, unplayed.lesson.id]);
  });

  it("starts one repair for a lesson an old writer finishes after migration", async () => {
    const [first, second] = await Promise.all([languageLessonFixture(), languageLessonFixture()]);

    await prisma.lessonSentence.update({
      data: { lessonId: first.lesson.id, position: 1 },
      where: {
        lessonId_sentenceId: { lessonId: second.lesson.id, sentenceId: second.sentence.id },
      },
    });

    await dailySweepsWorkflow(scheduledRun());

    const started = getStartMock()
      .mock.calls.filter(([workflow]) => workflow === sentenceOrdersWorkflow)
      .flatMap(([, args]) => (args as [{ lessonIds: string[] }])[0].lessonIds);

    expect(started.filter((id) => id === first.lesson.id)).toStrictEqual([first.lesson.id]);
    expect(started).not.toContain(second.lesson.id);
  });

  it("starts the rewrite of what a changed source left flagged", async () => {
    const [law, lesson] = await Promise.all([
      sourceFixture({ language: "pt", title: "Lei nº 8.112, de 11 de dezembro de 1990" }),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    await libraryStepFixture({
      generatedAt: new Date(Date.now() - DAY_MS),
      lessonId: lesson.id,
      sourceId: law.id,
    });

    const owed = await unnoticedSourceChangeFixture({ previousHash: "old", sourceId: law.id });

    await recordSourceChangeNotice({
      ...owed,
      contentHash: "new",
      fields: ["text"],
      language: "pt",
      message: "A lei mudou.",
      provenance: { generatedAt: new Date(), model: "test", promptVersion: "v1", runId: "r1" },
      sourceId: law.id,
    });

    await expect(dailySweepsWorkflow(scheduledRun())).resolves.toMatchObject({
      flaggedContentStarted: true,
    });

    expect(start).toHaveBeenCalledWith(flaggedContentWorkflow, [{}]);
  });

  it("starts nothing when another delivery of the same scheduled run already took it", async () => {
    const executionId = randomUUID();

    await examBlueprintFixture({ nextCheckAt: new Date(Date.now() + DAY_MS - 60_000) });

    mockHookConflict(
      { returnValue: Promise.resolve(null), runId: "first-delivery" },
      { tokens: new RegExp(`^daily-sweeps:${executionId}$`, "u") },
    );

    await expect(dailySweepsWorkflow({ executionId })).resolves.toStrictEqual({
      runId: "first-delivery",
      status: "alreadyRan",
    });

    expect(start).not.toHaveBeenCalled();
  });

  it("sweeps the next scheduled run while the one before still holds its own", async () => {
    mockHookConflict(
      { returnValue: Promise.resolve(null), runId: "yesterdays-sweep" },
      { tokens: /^daily-sweeps:yesterdays-execution$/u },
    );

    await expect(dailySweepsWorkflow(scheduledRun())).resolves.toMatchObject({ status: "swept" });
  });

  it("counts a sweep that failed as nothing and still runs the others", async () => {
    const [exam] = await Promise.all([
      // The sweep takes the latest due first, so other tests' due exams can't push this one out of
      // its batch.
      examBlueprintFixture({ nextCheckAt: new Date(Date.now() + DAY_MS - 60_000) }),
      evaluationRunFixture({ createdAt: new Date(Date.now() - 31 * DAY_MS) }),
    ]);

    getStartMock().mockImplementation(async (workflow) => {
      if (workflow === freshnessWorkflow) {
        throw new Error("Queue unavailable");
      }

      return { runId: "started-run" } as Awaited<ReturnType<typeof start>>;
    });

    const result = await dailySweepsWorkflow(scheduledRun());
    assert(result.status === "swept");

    expect(start).toHaveBeenCalledWith(
      freshnessWorkflow,
      [{ examBlueprintId: exam.id, kind: "exam" }],
      { experimental_hook: { token: `freshness:exam:${exam.id}` } },
    );

    expect(result.freshnessChecks).toBe(0);
    expect(result.evaluationRunsPurged).toBeGreaterThanOrEqual(1);
  });
});
