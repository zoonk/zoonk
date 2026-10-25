import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { signedInCourseGoal } from "../_test-utils/course-goal";
import { getChapterView } from "../chapter/get-chapter-view";
import { getPlanTabView } from "./get-plan-view";

async function readChapter(chapterId: string) {
  const result = await getChapterView({ chapterId });
  const view = result.status === "ready" ? result.chapter : null;

  return {
    next: view?.lessons.find((lesson) => lesson.state === "next")?.lessonId,
    state: view?.chapter.state,
  };
}

describe("the lesson up next", () => {
  // Pedro's Today opened "Where a share's price comes from", of his second phase, while his
  // Plan and the first phase's chapter page marked the first phase's chapter as up next.
  it("is the lesson Today opens, on the Journey and on the chapters' pages, even in the next phase", async () => {
    freezeClock();

    const { chapters, goal, items, lessons, user } = await signedInCourseGoal({
      statuses: ["done", "todo", "todo", "todo"],
    });

    const [first, second] = chapters.map((chapter) => chapter.id);

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) }),
      userId: user.id,
    });

    await studySessionBlockFixture({
      lessonId: lessons[2]?.id,
      payload: { planItemId: items[2]?.id },
      position: 0,
      sessionId: session.id,
      status: "pending",
    });

    // A saved session can already include a later lesson of the current phase, although the
    // plan dates it tomorrow. Its chapter resumes today, after the next phase's first lesson.
    const tomorrow = new Date(session.localDate.getTime() + MS_PER_DAY);

    await Promise.all([
      prisma.planItem.update({
        data: { scheduledFor: tomorrow },
        where: { id: items[1]?.id ?? "" },
      }),
      studySessionBlockFixture({
        lessonId: lessons[1]?.id,
        payload: { planItemId: items[1]?.id },
        position: 1,
        sessionId: session.id,
        status: "pending",
      }),
    ]);

    const result = await getPlanTabView();
    const plan = result.status === "ready" ? result.view.plan : null;

    expect(plan?.phases[0]?.chapters[0]?.nextDate).toBe(
      session.localDate.toISOString().slice(0, 10),
    );

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: items[1]?.id ?? "" } }),
    ).resolves.toMatchObject({ scheduledFor: tomorrow });

    expect(
      plan?.phases.map((phase) => [
        phase.state,
        phase.chapters.map((chapter) => [chapter.chapterId, chapter.state]),
      ]),
    ).toStrictEqual([
      ["current", [[first, "upcoming"]]],
      ["upcoming", [[second, "current"]]],
    ]);

    await expect(readChapter(second ?? "")).resolves.toStrictEqual({
      next: lessons[2]?.id,
      state: "current",
    });

    await expect(readChapter(first ?? "")).resolves.toMatchObject({ state: "upcoming" });
  });
});
