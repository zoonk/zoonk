import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { findTestOutOffer } from "./_utils/test-out-offer";

const MINUTE_MS = 60_000;

/** A chapter of five lessons teaching one skill, planned in order for a learner's goal. */
async function setup() {
  const [user, chapter, skill] = await Promise.all([
    userFixture(),
    libraryChapterFixture({ title: "Reading the notice" }),
    skillFixture(),
  ]);

  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const lessons = await Promise.all(
    Array.from({ length: 5 }, () => libraryLessonFixture({ homeChapterId: chapter.id })),
  );

  const items = await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        planId: plan.id,
        position,
        skillId: skill.id,
      }),
    ),
  );

  return { chapter, goal, items, lessons, user };
}

/**
 * Finishes a lesson in order: its plan item is done and the ledger has its first completion,
 * with every answer right or with a mistake.
 */
async function finish({
  index,
  setup: { items, lessons, user },
  wrong = 0,
}: {
  index: number;
  setup: Awaited<ReturnType<typeof setup>>;
  wrong?: number;
}) {
  await Promise.all([
    prisma.planItem.update({ data: { status: "done" }, where: { id: items[index]?.id ?? "" } }),
    learningEventFixture({
      contentIds: { lessonId: lessons[index]?.id },
      correctAnswers: 4 - wrong,
      endedAt: new Date(Date.now() - (10 - index) * MINUTE_MS),
      incorrectAnswers: wrong,
      userId: user.id,
    }),
  ]);
}

function offerAfter({
  index,
  setup: { goal, lessons, user },
}: {
  index: number;
  setup: Awaited<ReturnType<typeof setup>>;
}) {
  return findTestOutOffer({ goalId: goal.id, lessonId: lessons[index]?.id ?? "", userId: user.id });
}

describe(findTestOutOffer, () => {
  it("offers the chapter's test once, right after a second lesson with every answer right", async () => {
    const lessonSetup = await setup();

    await finish({ index: 0, setup: lessonSetup });
    await expect(offerAfter({ index: 0, setup: lessonSetup })).resolves.toBeNull();

    await finish({ index: 1, setup: lessonSetup });

    await expect(offerAfter({ index: 1, setup: lessonSetup })).resolves.toStrictEqual({
      chapterId: lessonSetup.chapter.id,
      chapterTitle: "Reading the notice",
      goalId: lessonSetup.goal.id,
      lessonsLeft: 3,
    });

    // Not after every easy lesson that follows: one offer, not nagging.
    await finish({ index: 2, setup: lessonSetup });
    await expect(offerAfter({ index: 2, setup: lessonSetup })).resolves.toBeNull();
  });

  it("waits for two easy lessons in a row after a mistake", async () => {
    const lessonSetup = await setup();

    await finish({ index: 0, setup: lessonSetup, wrong: 1 });
    await finish({ index: 1, setup: lessonSetup });
    await expect(offerAfter({ index: 1, setup: lessonSetup })).resolves.toBeNull();

    await finish({ index: 2, setup: lessonSetup });

    await expect(offerAfter({ index: 2, setup: lessonSetup })).resolves.toMatchObject({
      lessonsLeft: 2,
    });
  });

  it("doesn't offer a test for the last lesson or two of a chapter", async () => {
    const lessonSetup = await setup();

    await Promise.all(
      [0, 1].map((index) =>
        prisma.planItem.update({
          data: { status: "testedOut" },
          where: { id: lessonSetup.items[index + 3]?.id ?? "" },
        }),
      ),
    );

    await finish({ index: 0, setup: lessonSetup });
    await finish({ index: 1, setup: lessonSetup });

    await expect(offerAfter({ index: 1, setup: lessonSetup })).resolves.toBeNull();
  });
});
