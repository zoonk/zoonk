import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "../_test-utils/create-lesson-context";
import { persistGeneratedLessonGroups } from "./persist-generated-lesson-groups";

describe(persistGeneratedLessonGroups, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("rolls back inserted lessons and shifted order when content persistence fails", async () => {
    const workflowRunId = "atomic-split-failure";

    const context = await createLessonContext({
      generationRunId: workflowRunId,
      generationStatus: "running",
      kind: "alphabet",
      organizationId,
    });

    const followingLesson = await lessonFixture({
      chapterId: context.chapterId,
      generationStatus: "pending",
      isPublished: true,
      kind: "grammar",
      organizationId,
      position: context.position + 1,
    });

    await expect(
      persistGeneratedLessonGroups({
        chapterId: context.chapterId,
        groupCount: 2,
        lessonId: context.id,
        persistGroups: () => Promise.reject(new Error("content persistence failed")),
        workflowRunId,
      }),
    ).rejects.toThrow("content persistence failed");

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: context.chapterId },
    });

    expect(lessons.map((lesson) => lesson.id)).toStrictEqual([context.id, followingLesson.id]);

    expect(lessons.map((lesson) => lesson.position)).toStrictEqual([
      context.position,
      followingLesson.position,
    ]);

    expect(lessons[0]?.generationStatus).toBe("running");
  });

  it("treats a retry after commit as a no-op", async () => {
    const workflowRunId = "atomic-split-replay";

    const context = await createLessonContext({
      generationRunId: workflowRunId,
      generationStatus: "running",
      kind: "alphabet",
      organizationId,
    });

    const persistGroups = vi.fn(async () => {});

    const input = {
      chapterId: context.chapterId,
      groupCount: 2,
      lessonId: context.id,
      persistGroups,
      workflowRunId,
    };

    await persistGeneratedLessonGroups(input);
    await persistGeneratedLessonGroups(input);

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: context.chapterId },
    });

    expect(persistGroups).toHaveBeenCalledOnce();
    expect(lessons).toHaveLength(2);
    expect(lessons.every((lesson) => lesson.generationStatus === "completed")).toBe(true);
    expect(lessons.every((lesson) => lesson.isPublished)).toBe(true);
  });

  it("preserves unpublished state for the root and its continuation lessons", async () => {
    const workflowRunId = "atomic-unpublished-split";

    const context = await createLessonContext({
      generationRunId: workflowRunId,
      generationStatus: "running",
      kind: "alphabet",
      organizationId,
    });

    await prisma.lesson.update({ data: { isPublished: false }, where: { id: context.id } });

    await persistGeneratedLessonGroups({
      chapterId: context.chapterId,
      groupCount: 2,
      lessonId: context.id,
      persistGroups: async () => {},
      workflowRunId,
    });

    const lessons = await prisma.lesson.findMany({ where: { chapterId: context.chapterId } });

    expect(lessons).toHaveLength(2);
    expect(lessons.every((lesson) => !lesson.isPublished)).toBe(true);
  });

  it("copies authored metadata with numbered titles for continuation lessons", async () => {
    const workflowRunId = "atomic-split-metadata";

    const context = await createLessonContext({
      generationRunId: workflowRunId,
      generationStatus: "running",
      kind: "vocabulary",
      organizationId,
    });

    await prisma.lesson.update({
      data: {
        description: "Learn useful words for everyday Cyrillic conversations.",
        normalizedTitle: "everyday cyrillic words",
        title: "Everyday Cyrillic words",
      },
      where: { id: context.id },
    });

    await persistGeneratedLessonGroups({
      chapterId: context.chapterId,
      groupCount: 3,
      lessonId: context.id,
      persistGroups: async () => {},
      workflowRunId,
    });

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: context.chapterId, kind: "vocabulary" },
    });

    expect(lessons.map((lesson) => lesson.title)).toStrictEqual([
      "Everyday Cyrillic words",
      "Everyday Cyrillic words 2",
      "Everyday Cyrillic words 3",
    ]);

    expect(lessons.map((lesson) => lesson.description)).toStrictEqual([
      "Learn useful words for everyday Cyrillic conversations.",
      "Learn useful words for everyday Cyrillic conversations.",
      "Learn useful words for everyday Cyrillic conversations.",
    ]);

    expect(lessons.map((lesson) => lesson.normalizedTitle)).toStrictEqual([
      "everyday cyrillic words",
      "everyday cyrillic words 2",
      "everyday cyrillic words 3",
    ]);
  });

  it("serializes concurrent splits in the same chapter", async () => {
    const firstRunId = "atomic-concurrent-first";
    const secondRunId = "atomic-concurrent-second";

    const firstContext = await createLessonContext({
      generationRunId: firstRunId,
      generationStatus: "running",
      kind: "alphabet",
      organizationId,
      position: 0,
    });

    const secondLesson = await lessonFixture({
      chapterId: firstContext.chapterId,
      generationRunId: secondRunId,
      generationStatus: "running",
      isPublished: true,
      kind: "alphabet",
      organizationId,
      position: 1,
    });

    await Promise.all([
      persistGeneratedLessonGroups({
        chapterId: firstContext.chapterId,
        groupCount: 2,
        lessonId: firstContext.id,
        persistGroups: async () => {},
        workflowRunId: firstRunId,
      }),
      persistGeneratedLessonGroups({
        chapterId: firstContext.chapterId,
        groupCount: 2,
        lessonId: secondLesson.id,
        persistGroups: async () => {},
        workflowRunId: secondRunId,
      }),
    ]);

    const lessons = await prisma.lesson.findMany({
      orderBy: { position: "asc" },
      where: { chapterId: firstContext.chapterId },
    });

    expect(lessons).toHaveLength(4);
    expect(lessons.map((lesson) => lesson.position)).toStrictEqual([0, 1, 2, 3]);
    expect(lessons[0]?.id).toBe(firstContext.id);
    expect(lessons[2]?.id).toBe(secondLesson.id);
    expect(lessons.every((lesson) => lesson.generationStatus === "completed")).toBe(true);
  });

  it("rejects stale completed companion content without modifying either lesson", async () => {
    const workflowRunId = "atomic-stale-companion";

    const context = await createLessonContext({
      generationRunId: workflowRunId,
      generationStatus: "running",
      kind: "vocabulary",
      organizationId,
    });

    const companion = await lessonFixture({
      chapterId: context.chapterId,
      generationStatus: "completed",
      isPublished: true,
      kind: "translation",
      organizationId,
      position: context.position + 1,
    });

    await expect(
      persistGeneratedLessonGroups({
        chapterId: context.chapterId,
        groupCount: 1,
        lessonId: context.id,
        persistGroups: vi.fn(),
        workflowRunId,
      }),
    ).rejects.toThrow("Completed companion cannot be replaced by source generation");

    const [sourceAfterFailure, companionAfterFailure] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: context.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: companion.id } }),
    ]);

    expect(sourceAfterFailure.generationStatus).toBe("running");
    expect(companionAfterFailure.generationStatus).toBe("completed");
  });
});
