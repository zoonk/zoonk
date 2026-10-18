import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadPaceSamples } from "./pace-samples";

const DAY_MS = 86_400_000;

/**
 * A day far from other tests' lessons: shared samples read the month before `now`, so they see
 * this test's lessons alone.
 */
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
      // Another learner still here took the plan's lesson in 4 minutes...
      learningEventFixture({
        contentIds: { lessonId: lesson.id },
        endedAt: yesterday,
        seconds: 240,
        userId: other.id,
      }),
      // ...and one who left took 8.
      prisma.anonymousLessonPace.create({
        data: { lessonId: lesson.id, localDate: yesterday, seconds: 480 },
      }),
    ]);

    const samples = await loadPaceSamples({ lessonIds: [lesson.id], now, userId: learner.id });

    expect(samples.course).toStrictEqual({ count: 2, ratio: 1.5 });
    expect(samples.typical).toStrictEqual({ count: 2, ratio: 1.5 });
    expect(samples.own).toBeNull();
  });
});
