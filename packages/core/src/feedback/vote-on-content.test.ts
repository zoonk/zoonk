import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  libraryStepFixture,
  mediaAssetFixture,
  stepVariantFixture,
} from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { voteOnContent } from "./vote-on-content";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** A public Library step with its own provenance. */
async function createLibraryStep() {
  const lesson = await libraryLessonFixture();
  return libraryStepFixture({ lessonId: lesson.id });
}

function listVotes(userId: string) {
  return prisma.contentFeedback.findMany({ where: { userId } });
}

/** A tutor answer in the learner's own question thread. */
async function createLessonQuestion(userId: string) {
  const thread = await prisma.lessonQuestionThread.create({ data: { userId } });

  return prisma.lessonQuestion.create({
    data: {
      answer: "Because of the carry.",
      contextKind: "lesson",
      contextSnapshot: {},
      model: "test/tutor-model",
      promptVersion: "test-tutor-prompt",
      question: "Why is it 10?",
      requestFingerprint: randomUUID(),
      requestId: randomUUID(),
      runId: "test-tutor-run",
      status: "completed",
      threadId: thread.id,
    },
  });
}

describe(voteOnContent, () => {
  it("requires a signed-in learner", async () => {
    const step = await createLibraryStep();
    mockSession(null);

    await expect(
      voteOnContent({ contentId: step.id, contentKind: "step", vote: "up" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    await expect(prisma.contentFeedback.count({ where: { contentId: step.id } })).resolves.toBe(0);
  });

  it("stores a downvote with its reasons, comment, language and the content's provenance", async () => {
    const [user, step] = await Promise.all([userFixture(), createLibraryStep()]);
    mockSession(user.id);

    const result = await voteOnContent({
      comment: "The second example contradicts the first.",
      contentId: step.id,
      contentKind: "step",
      language: "pt",
      reasons: ["wrongOrOutdated", "hardToFollow", "wrongOrOutdated"],
      vote: "down",
    });

    expect(result).toStrictEqual({
      status: "voted",
      vote: {
        comment: "The second example contradicts the first.",
        contentId: step.id,
        contentKind: "step",
        reasons: ["wrongOrOutdated", "hardToFollow"],
        updatedAt: expect.any(Date),
        vote: "down",
      },
    });

    await expect(listVotes(user.id)).resolves.toStrictEqual([
      expect.objectContaining({
        contentId: step.id,
        contentKind: "step",
        language: "pt",
        model: step.model,
        promptVersion: step.promptVersion,
        reasons: ["wrongOrOutdated", "hardToFollow"],
        runId: step.runId,
        vote: "down",
      }),
    ]);
  });

  it("keeps one vote per learner and content, and a new vote replaces the old one", async () => {
    const [user, otherUser, step] = await Promise.all([
      userFixture(),
      userFixture(),
      createLibraryStep(),
    ]);

    mockSession(otherUser.id);
    await voteOnContent({ contentId: step.id, contentKind: "step", vote: "up" });

    mockSession(user.id);

    await voteOnContent({
      comment: "Too dense",
      contentId: step.id,
      contentKind: "step",
      reasons: ["tooHard"],
      vote: "down",
    });

    await prisma.step.update({
      data: { model: "test/regenerated-model", promptVersion: "test-v2" },
      where: { id: step.id },
    });

    await voteOnContent({ contentId: step.id, contentKind: "step", vote: "up" });

    await expect(listVotes(user.id)).resolves.toStrictEqual([
      expect.objectContaining({
        comment: null,
        model: "test/regenerated-model",
        promptVersion: "test-v2",
        reasons: [],
        vote: "up",
      }),
    ]);

    await expect(listVotes(otherUser.id)).resolves.toStrictEqual([
      expect.objectContaining({ vote: "up" }),
    ]);
  });

  it("snapshots the provenance of catalog content", async () => {
    const [user, course, chapter, lesson] = await Promise.all([
      userFixture(),
      courseFixture({ outlineRunId: "course-run" }),
      libraryChapterFixture({ model: "test/chapter-model", runId: "chapter-run" }),
      libraryLessonFixture({ model: "test/lesson-model", runId: "lesson-run" }),
    ]);

    mockSession(user.id);

    await Promise.all([
      voteOnContent({ contentId: course.id, contentKind: "course", vote: "up" }),
      voteOnContent({ contentId: chapter.id, contentKind: "chapter", vote: "down" }),
      voteOnContent({ contentId: lesson.id, contentKind: "lesson", vote: "up" }),
    ]);

    const votes = await prisma.contentFeedback.findMany({
      orderBy: { contentKind: "asc" },
      select: { contentKind: true, model: true, runId: true, vote: true },
      where: { userId: user.id },
    });

    expect(votes).toStrictEqual([
      { contentKind: "course", model: null, runId: "course-run", vote: "up" },
      { contentKind: "chapter", model: "test/chapter-model", runId: "chapter-run", vote: "down" },
      { contentKind: "lesson", model: "test/lesson-model", runId: "lesson-run", vote: "up" },
    ]);
  });

  it("snapshots the run behind the learner's own tutor answer", async () => {
    const user = await userFixture();
    const question = await createLessonQuestion(user.id);
    mockSession(user.id);

    await voteOnContent({ contentId: question.id, contentKind: "lessonQuestion", vote: "up" });

    await expect(listVotes(user.id)).resolves.toStrictEqual([
      expect.objectContaining({
        model: "test/tutor-model",
        promptVersion: "test-tutor-prompt",
        runId: "test-tutor-run",
      }),
    ]);
  });

  it("does not store votes on content the learner can't see", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);

    const [privateLesson, otherGoal, otherQuestion] = await Promise.all([
      libraryLessonFixture({ ownerId: otherUser.id, visibility: "private" }),
      goalFixture({ userId: otherUser.id }),
      createLessonQuestion(otherUser.id),
    ]);

    const otherPlan = await planFixture({ goalId: otherGoal.id });
    mockSession(user.id);

    const results = await Promise.all([
      voteOnContent({ contentId: randomUUID(), contentKind: "step", vote: "up" }),
      voteOnContent({ contentId: privateLesson.id, contentKind: "lesson", vote: "up" }),
      voteOnContent({ contentId: otherPlan.id, contentKind: "plan", vote: "down" }),
      voteOnContent({ contentId: otherQuestion.id, contentKind: "lessonQuestion", vote: "up" }),
    ]);

    expect(results).toStrictEqual(Array.from({ length: 4 }, () => ({ status: "notFound" })));
    await expect(listVotes(user.id)).resolves.toStrictEqual([]);
  });

  it("stores votes on the learner's own private lesson and plan", async () => {
    const user = await userFixture();

    const [privateLesson, goal] = await Promise.all([
      libraryLessonFixture({ ownerId: user.id, visibility: "private" }),
      goalFixture({ userId: user.id }),
    ]);

    const plan = await planFixture({ goalId: goal.id, model: "test/planner", runId: "plan-run" });
    mockSession(user.id);

    const results = await Promise.all([
      voteOnContent({ contentId: privateLesson.id, contentKind: "lesson", vote: "up" }),
      voteOnContent({ contentId: plan.id, contentKind: "plan", vote: "up" }),
    ]);

    expect(results).toStrictEqual([
      expect.objectContaining({ status: "voted" }),
      expect.objectContaining({ status: "voted" }),
    ]);

    await expect(
      prisma.contentFeedback.findUniqueOrThrow({
        where: { userContent: { contentId: plan.id, contentKind: "plan", userId: user.id } },
      }),
    ).resolves.toMatchObject({ model: "test/planner", runId: "plan-run" });
  });

  it("stores votes on a screen's field version and its image with their own provenance", async () => {
    const [user, step, image] = await Promise.all([
      userFixture(),
      createLibraryStep(),
      mediaAssetFixture({ model: "test/image-model", runId: "image-run" }),
    ]);

    const version = await stepVariantFixture({
      model: "test/variant-model",
      runId: "variant-run",
      stepId: step.id,
    });

    mockSession(user.id);

    await Promise.all([
      voteOnContent({ contentId: version.id, contentKind: "stepVariant", vote: "down" }),
      voteOnContent({ contentId: image.id, contentKind: "mediaAsset", vote: "up" }),
    ]);

    const votes = await prisma.contentFeedback.findMany({
      orderBy: { contentKind: "asc" },
      select: { contentId: true, contentKind: true, model: true, runId: true, vote: true },
      where: { userId: user.id },
    });

    expect(votes).toStrictEqual([
      {
        contentId: version.id,
        contentKind: "stepVariant",
        model: "test/variant-model",
        runId: "variant-run",
        vote: "down",
      },
      {
        contentId: image.id,
        contentKind: "mediaAsset",
        model: "test/image-model",
        runId: "image-run",
        vote: "up",
      },
    ]);

    await expect(
      prisma.contentFeedback.count({ where: { contentId: step.id, userId: user.id } }),
    ).resolves.toBe(0);
  });

  it("does not store a vote on a version of another learner's private lesson", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);

    const privateLesson = await libraryLessonFixture({
      ownerId: otherUser.id,
      visibility: "private",
    });

    const step = await libraryStepFixture({ lessonId: privateLesson.id });
    const version = await stepVariantFixture({ stepId: step.id });
    mockSession(user.id);

    await expect(
      voteOnContent({ contentId: version.id, contentKind: "stepVariant", vote: "up" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(listVotes(user.id)).resolves.toStrictEqual([]);
  });
});
