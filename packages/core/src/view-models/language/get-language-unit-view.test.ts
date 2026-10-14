import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getLanguageUnitView } from "./get-language-unit-view";

/** A pattern noticed in some of the learner's mistakes, as the pattern check saves it. */
function patternFixture({
  mistakeIds,
  title,
  userId,
}: {
  mistakeIds: string[];
  title: string;
  userId: string;
}) {
  return prisma.mistakePattern.create({
    data: {
      content: { contrast: [], drill: [], examples: [], rule: "A rule." },
      kind: "pattern",
      language: "en",
      mistakeIds,
      model: "test",
      promptVersion: "test",
      runId: "test",
      title,
      userId,
    },
  });
}

describe("a language unit's page", () => {
  it("waits after a failed unit test until a lesson in that unit is studied", async () => {
    freezeClock();
    const { goal, lessons, renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const failedAt = new Date(Date.now() - 60_000);

    await learningEventFixture({
      contentIds: { chapterId: renting.id },
      correctAnswers: 1,
      endedAt: failedAt,
      goalId: goal.id,
      incorrectAnswers: 7,
      kind: "questions",
      lessonKind: "testOut",
      userId: user.id,
    });

    await expect(getLanguageUnitView({ chapterId: renting.id })).resolves.toMatchObject({
      unit: { canTestOut: false },
    });

    await learningEventFixture({ contentIds: { lessonId: lessons[2]?.id }, userId: user.id });

    await expect(getLanguageUnitView({ chapterId: renting.id })).resolves.toMatchObject({
      unit: { canTestOut: true },
    });
  });

  it("lists its lessons with their minutes and whether they're written, and keeps the summaries the finished ones left", async () => {
    const { items, lessons, renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const done = lessons[2];
    const next = lessons[3];

    await Promise.all([
      prisma.lesson.update({
        data: {
          contentStatus: "completed",
          estimatedMinutes: 6,
          summary: { ideas: [{ text: "Rent é o aluguel." }] },
        },
        where: { id: done?.id },
      }),
      prisma.lesson.update({
        data: { estimatedMinutes: 4, summary: { ideas: [{ text: "Not read yet." }] } },
        where: { id: next?.id },
      }),
      prisma.planItem.update({
        data: { completedAt: new Date(), status: "done" },
        where: { id: items[2]?.id },
      }),
    ]);

    const result = await getLanguageUnitView({ chapterId: renting.id });
    const unit = result.status === "ready" ? result.unit : null;

    expect(unit?.lessons).toStrictEqual([
      {
        done: true,
        lessonId: done?.id,
        minutes: 6,
        state: "done",
        title: done?.title,
        written: true,
      },
      {
        done: false,
        lessonId: next?.id,
        minutes: 4,
        state: "next",
        title: next?.title,
        written: false,
      },
    ]);

    expect(unit?.summaries).toStrictEqual([
      { ideas: ["Rent é o aluguel."], lessonId: done?.id, title: done?.title },
    ]);
  });

  // Marcos's unit page marked "Introducing yourself" next while Today opened "Summary".
  it("marks next the lesson today's session opens next, not the first one not done", async () => {
    freezeClock();

    const { goal, lessons, renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const first = lessons[2];
    const second = lessons[3];

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) }),
      userId: user.id,
    });

    await studySessionBlockFixture({
      lessonId: second?.id,
      sessionId: session.id,
      status: "active",
    });

    const result = await getLanguageUnitView({ chapterId: renting.id });
    const unit = result.status === "ready" ? result.unit : null;

    expect(unit?.lessons.map((lesson) => [lesson.lessonId, lesson.state])).toStrictEqual([
      [first?.id, "upcoming"],
      [second?.id, "next"],
    ]);
  });

  it("offers the pattern noticed in its own mistakes and the words due to be said again", async () => {
    const { lessons, renting, user } = await languageGoalFixture();
    mockSession(user.id);
    const [arrivingLesson, , rentingLesson] = lessons;

    // Words are shared by everyone in the organization: this one is the test's own.
    const spoken = `rent-${crypto.randomUUID()}`;

    const [rentingStep, arrivingStep, org] = await Promise.all([
      libraryStepFixture({ kind: "typedAnswer", lessonId: rentingLesson?.id ?? "" }),
      libraryStepFixture({ kind: "typedAnswer", lessonId: arrivingLesson?.id ?? "" }),
      aiOrganizationFixture(),
    ]);

    const [rentingMistake, arrivingMistake, word] = await Promise.all([
      mistakeFixture({ stepId: rentingStep.id, userId: user.id }),
      mistakeFixture({ stepId: arrivingStep.id, userId: user.id }),
      wordFixture({ organizationId: org.id, targetLanguage: "en", word: spoken }),
    ]);

    const unitPattern = await patternFixture({
      mistakeIds: [rentingMistake.id],
      title: "is e are",
      userId: user.id,
    });

    // Newer, but shown by another unit's mistake: not this unit's.
    await Promise.all([
      patternFixture({ mistakeIds: [arrivingMistake.id], title: "in e at", userId: user.id }),
      pronunciationReviewFixture({ userId: user.id, wordId: word.id }),
    ]);

    const result = await getLanguageUnitView({ chapterId: renting.id });

    expect(result).toMatchObject({
      status: "ready",
      unit: {
        pattern: { id: unitPattern.id, kind: "pattern", title: "is e are" },
        pronunciation: { count: 1, words: [spoken] },
      },
    });
  });
});
