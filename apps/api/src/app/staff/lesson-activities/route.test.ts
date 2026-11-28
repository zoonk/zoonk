import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { describe, expect, it } from "vitest";
import { signInStaff, staffRequest } from "../_test-utils/requests";
import { sendStaffAuthorization } from "../_test-utils/staff-authorization";
import { POST as draft } from "./route";

function call(body: unknown) {
  return draft(staffRequest({ body, path: "/staff/lesson-activities" }));
}

describe("staff lesson activities authority", () => {
  it("requires the staff role and skips a lesson that isn't written", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "pending" });
    const body = { lessonIds: [lesson.id] };

    sendStaffAuthorization();
    await expect(call(body)).resolves.toMatchObject({ status: 401 });

    const { user } = await signInStaff();
    const response = await call(body);

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toStrictEqual({
      fixes: [],
      lessons: [{ lessonId: lesson.id, reason: "Not written yet.", status: "skipped" }],
    });

    await prisma.user.update({ data: { role: null }, where: { id: user.id } });
    await expect(call(body)).resolves.toMatchObject({ status: 403 });
  });

  it.each([
    { lessonIds: [] },
    { lessonIds: ["not-an-id"] },
    { lessonIds: Array.from({ length: 6 }, () => crypto.randomUUID()) },
    { lessonIds: [crypto.randomUUID()], model: "openai/gpt-6.1-sol" },
  ])("refuses an invalid page of lessons (%j)", async (body) => {
    await signInStaff();
    await expect(call(body)).resolves.toMatchObject({ status: 400 });
  });
});
