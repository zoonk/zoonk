import { randomUUID } from "node:crypto";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { describe, expect, it } from "vitest";
import { signInStaff } from "../../_test-utils/requests";
import { sendStaffAuthorization } from "../../_test-utils/staff-authorization";
import { GET as getStaffLesson } from "./route";

function readLesson(lessonId: string) {
  return getStaffLesson(new Request(`http://localhost/staff/lessons/${lessonId}`), {
    params: Promise.resolve({ lessonId }),
  });
}

describe("GET /staff/lessons/:lessonId", () => {
  it("checks staff authorization before validating the lesson id", async () => {
    sendStaffAuthorization();
    await expect(readLesson("bad-id")).resolves.toHaveProperty("status", 401);

    await signInStaff();
    await expect(readLesson("bad-id")).resolves.toHaveProperty("status", 400);
    await expect(readLesson(randomUUID())).resolves.toHaveProperty("status", 404);
  });

  it("returns the staff lesson as JSON", async () => {
    const [lesson] = await Promise.all([libraryLessonFixture(), signInStaff()]);
    const step = await libraryStepFixture({ lessonId: lesson.id, position: 0 });

    const variant = await stepVariantFixture({
      content: { text: "A worked example for nurses." },
      stepId: step.id,
    });

    const response = await readLesson(lesson.id);

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      id: lesson.id,
      ideas: [],
      plan: null,
      screens: [{ id: step.id, variants: [{ content: variant.content, id: variant.id }] }],
      sentences: [],
      version: step.version,
      words: [],
    });
  });
});
