import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSession } from "../../users/get-session";
import { pullLessonsForRegeneration } from "./regenerate-lessons";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

function mockAdminSession(userId: string) {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the identity and role are read.
    { user: { id: userId, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );
}

async function writtenLessonFixture({
  model,
  promptVersion,
}: {
  model: string;
  promptVersion: string;
}) {
  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    specStatus: "completed",
  });

  await libraryStepFixture({ lessonId: lesson.id, model, position: 0, promptVersion });

  return lesson;
}

describe(pullLessonsForRegeneration, () => {
  it("pulls the published lessons a prompt version wrote and leaves the others", async () => {
    const admin = await userFixture({ role: "admin" });
    const promptVersion = `test-${randomUUID()}`;
    const model = `test/model-${randomUUID()}`;

    const [matching, otherPrompt, unpublished] = await Promise.all([
      writtenLessonFixture({ model, promptVersion }),
      writtenLessonFixture({ model, promptVersion: `other-${randomUUID()}` }),
      libraryLessonFixture({ contentStatus: "pending", specStatus: "completed" }),
    ]);

    await libraryStepFixture({ lessonId: unpublished.id, model, position: 0, promptVersion });

    mockAdminSession(admin.id);

    await expect(pullLessonsForRegeneration({ promptVersion })).resolves.toStrictEqual({
      lessonIds: [matching.id],
      status: "pulled",
    });

    const lessons = await prisma.lesson.findMany({
      select: { contentStatus: true, id: true },
      where: { id: { in: [matching.id, otherPrompt.id, unpublished.id] } },
    });

    expect(
      Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson.contentStatus])),
    ).toStrictEqual({
      [matching.id]: "failed",
      [otherPrompt.id]: "completed",
      [unpublished.id]: "pending",
    });
  });

  it("matches a model across prompt versions, but not explanations written without a spec", async () => {
    const admin = await userFixture({ role: "admin" });
    const model = `test/model-${randomUUID()}`;

    const [first, second] = await Promise.all([
      writtenLessonFixture({ model, promptVersion: "a" }),
      writtenLessonFixture({ model, promptVersion: "b" }),
    ]);

    const explanation = await libraryLessonFixture({ contentStatus: "completed" });
    await libraryStepFixture({ lessonId: explanation.id, model, position: 0 });

    mockAdminSession(admin.id);

    const result = await pullLessonsForRegeneration({ model });

    expect(result.status).toBe("pulled");

    expect(result.status === "pulled" && result.lessonIds.toSorted()).toStrictEqual(
      [first.id, second.id].toSorted(),
    );

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: explanation.id } }),
    ).resolves.toMatchObject({ contentStatus: "completed" });
  });

  it("requires an admin and a filter", async () => {
    const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);

    mockSession(null);

    await expect(pullLessonsForRegeneration({ model: "any" })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    mockSession(learner.id);

    await expect(pullLessonsForRegeneration({ model: "any" })).resolves.toStrictEqual({
      status: "forbidden",
    });

    mockAdminSession(admin.id);
    await expect(pullLessonsForRegeneration({})).resolves.toStrictEqual({ status: "invalid" });
  });
});
