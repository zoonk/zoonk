import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as nextCache from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession } from "../../_test-utils/mock-session";
import { lessonRunFixture } from "../../lesson-player/_test-utils/lesson-run-fixture";
import { loadDayPlusLessons, loadExamPrepAccess } from "./plus-only-lessons";

const TODAY = new Date("2026-10-17T00:00:00Z");
const TOMORROW = new Date("2026-10-18T00:00:00Z");

describe(loadExamPrepAccess, () => {
  it("ends a guest's free exam week on the request's day after IO suspension", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGuestSession(user.id);

    const goal = await goalFixture({
      createdAt: new Date("2026-10-07T12:00:00Z"),
      kind: "exam",
      timezone: "UTC",
      userId: user.id,
    });

    const entered = Promise.withResolvers<null>();
    const request = Promise.withResolvers<null>();
    /** The real DB stays in use; only Next's request boundary has no request in Vitest. */
    const boundary = vi.spyOn(nextCache, "io").mockImplementationOnce(async () => {
      entered.resolve(null);
      await request.promise;
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T23:59:59Z"));

    try {
      const access = loadExamPrepAccess({ goal });
      await Promise.race([entered.promise, access]);

      vi.setSystemTime(new Date("2026-10-14T00:00:01Z"));
      request.resolve(null);

      await expect(access).resolves.toMatchObject({ trialEnded: true });
    } finally {
      request.resolve(null);
      boundary.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe(loadDayPlusLessons, () => {
  // A day not opened yet reads the plan as it selects it, which may not be saved yet: its new
  // lessons were left out of Today until the day was opened.
  it("lists the day's lessons a free plan holds for Plus, saved or not, but the ones begun", async () => {
    const [user, fresh, begun, done, later] = await Promise.all([
      userFixture(),
      playableLessonFixture(),
      playableLessonFixture(),
      playableLessonFixture(),
      playableLessonFixture(),
    ]);

    const goal = await goalFixture({ kind: "exam", userId: user.id });

    await lessonRunFixture({ lessonId: begun.lesson.id, userId: user.id });

    const todo = { kind: "lesson", scheduledFor: TODAY, status: "todo" } as const;

    const items = [
      { ...todo, lessonId: fresh.lesson.id, titleSnapshot: "Fresh lesson" },
      { ...todo, lessonId: begun.lesson.id, titleSnapshot: "Begun lesson" },
      { ...todo, lessonId: done.lesson.id, status: "done", titleSnapshot: "Done lesson" },
      { ...todo, lessonId: later.lesson.id, scheduledFor: TOMORROW, titleSnapshot: "Later lesson" },
      { ...todo, lessonId: null, titleSnapshot: "Lesson still to write" },
    ] as const;

    const day = { goalId: goal.id, items, localDate: TODAY, userId: user.id };

    await expect(
      loadDayPlusLessons({ ...day, access: { includesMockExams: false, trialEnded: true } }),
    ).resolves.toStrictEqual([{ title: "Fresh lesson" }, { title: "Lesson still to write" }]);

    await expect(
      loadDayPlusLessons({ ...day, access: { includesMockExams: false, trialEnded: false } }),
    ).resolves.toStrictEqual([]);
  });
});
