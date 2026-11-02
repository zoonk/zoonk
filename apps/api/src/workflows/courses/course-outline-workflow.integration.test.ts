import { generateCourseOutline } from "@zoonk/ai/tasks/curriculum/course-outline";
import { COURSE_OUTLINE_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { FatalError } from "workflow";
import { start } from "workflow/api";
import { readStreamToEnd } from "../_test-utils/read-run-stream";
import { courseOutlineWorkflow } from "./course-outline-workflow";

vi.mock("@zoonk/ai/tasks/curriculum/course-outline", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateCourseOutline: vi.fn(),
}));

async function privateScope() {
  const owner = await userFixture();
  return { generalGoal: null, language: "en", ownerId: owner.id, targetLanguage: null };
}

describe(courseOutlineWorkflow, () => {
  it("ends the run's stream when the course already has what was asked", async () => {
    const [course, chapter, scope] = await Promise.all([
      courseFixture(),
      libraryChapterFixture(),
      privateScope(),
    ]);

    await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });

    const run = await start(courseOutlineWorkflow, [
      { bands: [{ level: "beginner", skills: [] }], courseId: course.id, scope },
    ]);

    await expect(run.returnValue).resolves.toMatchObject({ bandsWritten: 0, status: "written" });

    await expect(readStreamToEnd(run)).resolves.toStrictEqual(
      expect.stringContaining(`"step":"${COURSE_OUTLINE_READY_STEP}"`),
    );
  });

  it("ends the run's stream when the outline can't be written", async () => {
    vi.mocked(generateCourseOutline).mockRejectedValue(new FatalError("No model answered"));

    const [course, skill, scope] = await Promise.all([
      courseFixture(),
      skillFixture(),
      privateScope(),
    ]);

    const run = await start(courseOutlineWorkflow, [
      {
        bands: [
          {
            level: "beginner",
            skills: [{ description: skill.description, id: skill.id, key: "k", name: skill.name }],
          },
        ],
        courseId: course.id,
        scope,
      },
    ]);

    await expect(run.returnValue).rejects.toThrow("No model answered");

    await expect(readStreamToEnd(run)).resolves.toStrictEqual(
      expect.stringContaining(`"step":"${WORKFLOW_ERROR_STEP}"`),
    );
  });
});
