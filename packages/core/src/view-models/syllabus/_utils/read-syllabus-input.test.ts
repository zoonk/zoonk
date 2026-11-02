import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../../_test-utils/course-goal";
import { readSyllabusInput } from "./read-syllabus-input";

describe(readSyllabusInput, () => {
  it("keeps only the syllabus's fields of each saved item, since each reader decodes the whole cached input", async () => {
    const { goal, user } = await signedInCourseGoal();
    const input = await readSyllabusInput(user.id, goal.id);

    expect(new Set(input?.items.flatMap((item) => Object.keys(item)))).toStrictEqual(
      new Set([
        "chapterId",
        "id",
        "kind",
        "lessonId",
        "lessons",
        "phase",
        "scheduledFor",
        "skillId",
        "status",
        "titleSnapshot",
      ]),
    );
  });
});
