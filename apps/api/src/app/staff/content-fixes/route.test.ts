import { STAFF_PROPOSE_SCOPE, STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { cliTokenFixture } from "../../../../../../packages/auth/src/_test-utils/cli-tokens";
import { staffRequest } from "../_test-utils/requests";
import { sendStaffAuthorization } from "../_test-utils/staff-authorization";
import { POST as proposeFix } from "./route";

async function signIn({ role, scopes }: { role?: "admin"; scopes: string[] }) {
  const user = await userFixture({ role });
  const { accessToken } = await cliTokenFixture({ scopes, user });
  sendStaffAuthorization(`Bearer ${accessToken}`);
  return user;
}

function renameLesson(lessonId: string) {
  return proposeFix(
    staffRequest({
      body: {
        changes: [{ id: lessonId, model: "Lesson", set: { title: "Adding fractions" } }],
        reason: "The title said subtracting.",
      },
      path: "/staff/content-fixes",
    }),
  );
}

function proposeBatch(changes: unknown[]) {
  return proposeFix(
    staffRequest({
      body: { fixes: changes.map((change) => ({ changes: [change] })), reason: "Titles." },
      path: "/staff/content-fixes",
    }),
  );
}

describe("POST /staff/content-fixes", () => {
  it("records a staff login's proposal for review and changes nothing yet", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    await signIn({ role: "admin", scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE] });

    const response = await renameLesson(lesson.id);

    expect(response.status).toBe(201);

    await expect(response.json()).resolves.toMatchObject({
      batchId: expect.any(String),
      fixes: [
        {
          changes: [
            { fields: [{ after: "Adding fractions", before: lesson.title, field: "title" }] },
          ],
          reviewUrl: expect.stringMatching(/\/content-fixes\/[\da-f-]+$/u),
          status: "proposed",
        },
      ],
      reviewUrl: expect.stringMatching(/\/content-fixes\/batches\/[\da-f-]+$/u),
    });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ title: lesson.title });
  });

  it("asks a read-only staff login to log in again", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    await signIn({ role: "admin", scopes: [STAFF_READ_SCOPE] });

    const response = await renameLesson(lesson.id);

    expect(response.status).toBe(403);

    await expect(response.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining("pnpm zoonk login") },
    });
  });

  it("refuses a missing token and a learner's login", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });

    sendStaffAuthorization();
    await expect(renameLesson(lesson.id)).resolves.toHaveProperty("status", 401);

    await signIn({ scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE] });
    await expect(renameLesson(lesson.id)).resolves.toHaveProperty("status", 403);
  });

  it("proposes a batch whole, or refuses it with each fix's problem", async () => {
    const [first, second] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    await signIn({ role: "admin", scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE] });

    const refused = await proposeBatch([
      { id: first.id, model: "Lesson", set: { title: "Fixed" } },
      { id: second.id, model: "Lesson", set: { title: " " } },
    ]);

    expect(refused.status).toBe(400);

    await expect(refused.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining("fixes[1]: title must be text") },
    });

    const proposed = await proposeBatch([
      { id: first.id, model: "Lesson", set: { title: "Fixed" } },
      { id: second.id, model: "Lesson", set: { title: "Fixed too" } },
    ]);

    expect(proposed.status).toBe(201);
    await expect(proposed.json()).resolves.toMatchObject({ fixes: [{}, {}] });
  });

  it("answers a fix the rules refuse with what to change", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    await signIn({ role: "admin", scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE] });

    const response = await proposeFix(
      staffRequest({
        body: {
          changes: [{ id: lesson.id, model: "Lesson", set: { slug: "x" } }],
          reason: "Rename.",
        },
        path: "/staff/content-fixes",
      }),
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining("Lesson.slug isn't fixable") },
    });
  });
});
