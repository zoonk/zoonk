import { randomUUID } from "node:crypto";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
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
    const response = await readLesson(lesson.id);

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      id: lesson.id,
      ideas: [],
      plan: null,
      screens: [],
      sentences: [],
      version: null,
      words: [],
    });
  });
});
