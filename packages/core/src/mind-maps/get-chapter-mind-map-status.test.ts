import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getChapterMindMap } from "./get-chapter-mind-map";
import { getChapterMindMapStatus } from "./get-chapter-mind-map-status";

const STRUCTURE = {
  branches: ["Atom", "Nucleus", "Electron"].map((title) => ({
    drawing: title,
    explanation: `What ${title} means`,
    points: [title],
    title,
  })),
  centralIdea: "Matter is made of atoms",
  comparison: null,
  summary: "Atoms have a nucleus and electrons",
  title: "Atoms",
};

describe(getChapterMindMapStatus, () => {
  it("reads the goal and the full view's one status statement, without chapter numbering", async () => {
    const { goal, chapters } = await signedInCourseGoal({
      statuses: ["done", "done", "todo", "todo"],
    });

    const chapterId = chapters[0]!.id;
    await prisma.chapterMindMap.create({ data: { chapterId, language: "en", status: "running" } });

    const counts = await countDatabaseStatements(() =>
      getChapterMindMapStatus({ chapterId, goalId: goal.id }),
    );

    assertReadBudget(counts, 2);
    expect(counts.result).toStrictEqual({ mindMap: { status: "generating" }, status: "ready" });
  });

  it.each([
    { name: "pending", stale: false, status: "pending" },
    { name: "running", stale: false, status: "running" },
    { name: "stale", stale: true, status: "running" },
    { name: "failed", stale: false, status: "failed" },
    { name: "invalidCompleted", stale: false, status: "completed" },
    { name: "ready", stale: false, status: "completed" },
  ] as const)("keeps the full view's $name status, without changing any rows", async (state) => {
    const { goal, chapters } = await signedInCourseGoal({
      statuses: ["done", "done", "todo", "todo"],
    });

    const chapterId = chapters[0]!.id;

    await prisma.lesson.updateMany({
      data: { contentStatus: "completed" },
      where: { chapters: { some: { chapterId } } },
    });

    const row = await prisma.chapterMindMap.create({
      data: {
        chapterId,
        language: "en",
        status: state.status,
        structure: state.name === "ready" ? STRUCTURE : undefined,
        updatedAt: state.stale ? new Date("2020-01-01T00:00:00Z") : new Date(),
      },
    });

    const full = await getChapterMindMap({ chapterId, goalId: goal.id });
    expect(full.status).toBe("ready");

    const result = await getChapterMindMapStatus({ chapterId, goalId: goal.id });

    expect(result).toStrictEqual({
      mindMap: { status: full.status === "ready" ? full.mindMap.status : "" },
      status: "ready",
    });

    await expect(prisma.chapterMindMap.findUnique({ where: { chapterId } })).resolves.toStrictEqual(
      row,
    );
  });

  it("keeps language units unavailable and private chapters owner-only", async () => {
    const { goal, chapters } = await signedInCourseGoal({
      statuses: ["done", "done", "todo", "todo"],
    });

    const chapterId = chapters[0]!.id;
    await prisma.goal.update({ data: { kind: "language" }, where: { id: goal.id } });

    await expect(getChapterMindMapStatus({ chapterId, goalId: goal.id })).resolves.toStrictEqual({
      mindMap: { status: "unavailable" },
      status: "ready",
    });

    const other = await userFixture();

    await prisma.chapter.update({
      data: { ownerId: other.id, visibility: "private" },
      where: { id: chapterId },
    });

    await expect(getChapterMindMapStatus({ chapterId, goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("preserves access and unfinished-chapter rules", async () => {
    const { goal, chapters } = await signedInCourseGoal();
    const chapterId = chapters[0]!.id;

    await expect(getChapterMindMapStatus({ chapterId, goalId: goal.id })).resolves.toStrictEqual({
      mindMap: { status: "unavailable" },
      status: "ready",
    });

    const unrelated = await libraryChapterFixture();

    await expect(
      getChapterMindMapStatus({ chapterId: unrelated.id, goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(getChapterMindMapStatus({ chapterId, goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(getChapterMindMapStatus({ chapterId, goalId: goal.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});
