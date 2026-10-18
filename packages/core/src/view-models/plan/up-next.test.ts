import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
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

    const result = await getPlanTabView();
    const plan = result.status === "ready" ? result.view.plan : null;

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
