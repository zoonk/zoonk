import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadPaceSamples } from "./pace-samples";

const DAY_MS = 86_400_000;

/** Shared samples read the month before `now`, so a far-off day sees this test's lessons alone. */
function isolatedNow(): Date {
  return new Date(Date.UTC(2091, 0, 1) + Math.floor(Math.random() * 100_000) * DAY_MS);
}

describe(loadPaceSamples, () => {
  it("counts the lessons of learners who deleted their accounts, kept without them", async () => {
    const now = isolatedNow();
    const yesterday = new Date(now.getTime() - DAY_MS);

    const [learner, other, lesson] = await Promise.all([
      userFixture(),
      userFixture(),
      libraryLessonFixture({ estimatedMinutes: 4 }),
    ]);

    await Promise.all([
      learningEventFixture({
        contentIds: { lessonId: lesson.id },
        endedAt: yesterday,
        seconds: 240,
        userId: other.id,
      }),
      prisma.anonymousLessonPace.create({
        data: { lessonId: lesson.id, localDate: yesterday, seconds: 480 },
      }),
    ]);

    const samples = await loadPaceSamples({
      family: "subject",
      lessonIds: [lesson.id],
      now,
      userId: learner.id,
    });

    expect(samples.course).toStrictEqual({ count: 2, ratio: 1.5 });
    expect(samples.typical).toStrictEqual({ count: 2, ratio: 1.5 });
    expect(samples.own).toBeNull();
  });

  it("separates own and shared lesson families after the latest-200 window", async () => {
    const now = isolatedNow();

    const [learner, other, subject, language] = await Promise.all([
      userFixture(),
      userFixture(),
      libraryLessonFixture({ estimatedMinutes: 4 }),
      libraryLessonFixture({ estimatedMinutes: 4, targetLanguage: "es" }),
    ]);

    const recent = new Date(now.getTime() - DAY_MS);

    await Promise.all([
      learningEventFixture({
        contentIds: { lessonId: subject.id },
        endedAt: recent,
        seconds: 240,
        userId: learner.id,
      }),
      learningEventFixture({
        contentIds: { lessonId: language.id },
        endedAt: recent,
        seconds: 480,
        userId: learner.id,
      }),
      learningEventFixture({
        contentIds: { lessonId: language.id },
        endedAt: recent,
        seconds: 480,
        userId: other.id,
      }),
      prisma.anonymousLessonPace.create({
        data: { lessonId: subject.id, localDate: recent, seconds: 240 },
      }),
    ]);

    const lessonIds = [subject.id, language.id];

    await expect(
      loadPaceSamples({ family: "subject", lessonIds, now, userId: learner.id }),
    ).resolves.toStrictEqual({
      course: { count: 1, ratio: 1 },
      own: { count: 1, ratio: 1 },
      typical: { count: 2, ratio: 1 },
    });

    await expect(
      loadPaceSamples({ family: "language", lessonIds, now, userId: learner.id }),
    ).resolves.toStrictEqual({
      course: { count: 1, ratio: 2 },
      own: { count: 1, ratio: 2 },
      typical: { count: 2, ratio: 2 },
    });
  });

  it("keeps the latest-200 window before family filtering and rejects outliers", async () => {
    const now = isolatedNow();

    const [learner, subject, language] = await Promise.all([
      userFixture(),
      libraryLessonFixture({ estimatedMinutes: 4 }),
      libraryLessonFixture({ estimatedMinutes: 4, targetLanguage: "es" }),
    ]);

    await learningEventFixture({
      contentIds: { lessonId: subject.id },
      endedAt: new Date(now.getTime() - 2 * DAY_MS),
      seconds: 240,
      userId: learner.id,
    });

    await Promise.all(
      Array.from({ length: 200 }, (_, index) =>
        learningEventFixture({
          contentIds: { lessonId: index === 0 ? subject.id : language.id },
          endedAt: new Date(now.getTime() - DAY_MS + index),
          seconds: index === 0 ? 10_000 : 240,
          userId: learner.id,
        }),
      ),
    );

    const samples = await loadPaceSamples({
      family: "subject",
      lessonIds: [],
      now,
      userId: learner.id,
    });

    expect(samples.own).toBeNull();
  });
});
