import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { temperatureSpec } from "./_test-utils/written-lessons";
import {
  listLessonsForLaterReview,
  prepareLaterReview,
  pullLessonForFix,
  toLaterReviewProblems,
} from "./later-reviews";

/** Lesson ids are sampled by their last hex digits; these land in and out of the one-in-five sample. */
function sampledId(): string {
  return `${randomUUID().slice(0, -8)}0000000a`;
}

function skippedId(): string {
  return `${randomUUID().slice(0, -8)}00000001`;
}

describe(listLessonsForLaterReview, () => {
  it("samples lessons published today that nobody has answered yet, leaving advanced ones out", async () => {
    const user = await userFixture();

    const [sampled, notSampled, advanced, answered] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed", id: sampledId() }),
      libraryLessonFixture({ contentStatus: "completed", id: skippedId() }),
      libraryLessonFixture({ contentStatus: "completed", id: sampledId(), level: "advanced" }),
      libraryLessonFixture({ contentStatus: "completed", id: sampledId() }),
    ]);

    const step = await libraryStepFixture({ lessonId: answered.id, position: 0 });
    await attemptFixture({ stepId: step.id, userId: user.id });

    const listed = await listLessonsForLaterReview({ limit: 1000 });

    expect(listed).toContain(sampled.id);
    expect(listed).not.toContain(notSampled.id);
    expect(listed).not.toContain(advanced.id);
    expect(listed).not.toContain(answered.id);
  });
});

describe(prepareLaterReview, () => {
  it("reads the lesson's current version as stored against its own plan, naming the model that wrote it and its reuse", async () => {
    const spec = temperatureSpec();

    const lesson = await libraryLessonFixture({
      contentStatus: "completed",
      spec,
      summary: { ideas: [{ text: "A rise moves up the thermometer." }] },
    });

    const [, step] = await Promise.all([
      // A version a check replaced stays for learners playing it, but isn't what's reviewed.
      libraryStepFixture({
        lessonId: lesson.id,
        model: "openai/gpt-6-luna",
        position: 0,
        retiredAt: new Date(),
        version: 1,
      }),
      libraryStepFixture({
        lessonId: lesson.id,
        model: "openai/gpt-6-sol",
        position: 0,
        version: 2,
      }),
    ]);

    await expect(prepareLaterReview(lesson.id)).resolves.toMatchObject({
      lesson: {
        screens: [{ content: step.content, kind: step.kind }],
        summary: ["A rise moves up the thermometer."],
      },
      // No goal plans it yet: a niche lesson, checked by the cheaper reviewer.
      reuse: "library",
      spec: { title: spec.title },
      version: 2,
      writerModel: "openai/gpt-6-sol",
    });
  });

  it("skips a lesson without a readable spec", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    await expect(prepareLaterReview(lesson.id)).resolves.toBeNull();
  });
});

describe(pullLessonForFix, () => {
  it("takes a published lesson out of play once, and leaves a lesson being rewritten alone", async () => {
    const [published, rewriting] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture({ contentRunId: randomUUID(), contentStatus: "running" }),
    ]);

    await expect(pullLessonForFix(published.id)).resolves.toBe(true);
    await expect(pullLessonForFix(published.id)).resolves.toBe(false);
    await expect(pullLessonForFix(rewriting.id)).resolves.toBe(false);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: published.id } }),
    ).resolves.toMatchObject({ contentStatus: "failed" });
  });
});

describe(toLaterReviewProblems, () => {
  it("replaces a published lesson only for something wrong, never for style or repetition", () => {
    const issue = { fix: "Mark 3 °C.", problem: "The key is 11 °C.", screen: 3 };

    expect(
      toLaterReviewProblems([{ ...issue, kind: "incorrect", severity: "blocking" }]),
    ).toStrictEqual([{ problem: "The key is 11 °C. Fix: Mark 3 °C.", screen: 3 }]);

    expect(
      toLaterReviewProblems([
        { ...issue, kind: "incorrect", severity: "minor" },
        { ...issue, kind: "scope", severity: "blocking" },
        { ...issue, kind: "weakCheck", severity: "blocking" },
      ]),
    ).toStrictEqual([]);
  });
});
