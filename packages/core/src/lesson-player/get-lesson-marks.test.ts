import { randomUUID } from "node:crypto";
import { markedPlayableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLessonMarks } from "./get-lesson-marks";

describe(getLessonMarks, () => {
  beforeEach(() => {
    mockSession(randomUUID());
  });

  it("returns each screen's marks and the map's about lines and icons, as the lesson's next read has them", async () => {
    const { icons, lesson, steps } = await markedPlayableLessonFixture();
    const marks = await getLessonMarks({ lessonId: lesson.id });

    expect(marks?.marksPending).toBe(false);
    expect(marks?.steps.map((step) => step.stepId)).toStrictEqual(steps.map((step) => step.id));

    expect(marks?.steps[1]?.marks).toMatchObject({
      icon: { smallUrl: icons.cloud.smallUrl, url: icons.cloud.url },
      underline: "a map of where it might be",
    });

    expect(marks?.summary?.ideas.map((idea) => idea.about)).toStrictEqual([
      "What the electron does around the nucleus",
      "How to read the cloud",
    ]);
  });

  it("returns nothing for another learner's private lesson", async () => {
    const owner = await userFixture();

    const { lesson } = await markedPlayableLessonFixture({
      lesson: { ownerId: owner.id, visibility: "private" },
    });

    await expect(getLessonMarks({ lessonId: lesson.id })).resolves.toBeNull();
  });
});
