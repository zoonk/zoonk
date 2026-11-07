import { randomUUID } from "node:crypto";
import { checkMindMapImage } from "@zoonk/ai/tasks/mind-maps/check";
import { generateMindMapImage } from "@zoonk/ai/tasks/mind-maps/image";
import { generateMindMapStructure } from "@zoonk/ai/tasks/mind-maps/structure";
import { uploadImage } from "@zoonk/core/images/upload";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FatalError, sleep } from "workflow";
import { getRun } from "workflow/api";
import { getStartMock } from "../_test-utils/start-mock";
import { TEST_IMAGE, imageProvenance } from "../images/_test-utils/image-results";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { chapterMindMapWorkflow } from "./chapter-mind-map-workflow";

const structure = {
  branches: ["Cells", "Nucleus", "Membrane"].map((title) => ({
    drawing: "a cell",
    explanation: `${title} in one sentence.`,
    points: [`A point on ${title}`],
    title,
  })),
  centralIdea: "Cells are the units of life.",
  comparison: null,
  summary: "Every living thing is made of cells.",
  title: "Cells",
};

const passedMapCheck = {
  data: { missing: [], passed: true, problems: [], transcript: [], unknown: [] },
  provenance: imageProvenance,
};

const failedMapCheck = {
  data: {
    missing: [],
    passed: false,
    problems: ["words that aren't in the map's text: 'Celss', 'Nucelus', 'Membrnae'"],
    transcript: ["Celss", "Nucelus", "Membrnae"],
    unknown: ["celss", "nucelus", "membrnae"],
  },
  provenance: imageProvenance,
};

function serveStoredPictures() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(TEST_IMAGE, { headers: { "content-type": "image/webp" } })),
  );
}

async function claimedChapter() {
  const [chapter, lesson] = await Promise.all([
    libraryChapterFixture({ title: "Cells" }),
    libraryLessonFixture({ contentStatus: "completed", title: "What a cell is" }),
  ]);

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 });

  await prisma.chapterMindMap.create({
    data: { chapterId: chapter.id, language: "en", status: "running" },
  });

  return chapter;
}

describe(chapterMindMapWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateMindMapStructure).mockResolvedValue({
      data: structure,
      provenance: imageProvenance,
      systemPrompt: "",
      userPrompt: "",
    });

    vi.mocked(generateMindMapImage).mockResolvedValue({
      data: { image: TEST_IMAGE, mediaType: "image/webp" },
      prompt: "",
      provenance: imageProvenance,
    });

    vi.mocked(checkMindMapImage).mockResolvedValue(passedMapCheck);

    serveStoredPictures();

    vi.mocked(uploadImage).mockImplementation(({ fileName }) =>
      Promise.resolve({ data: `https://blob.test/${fileName}-${randomUUID()}`, error: null }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes the chapter's lessons through their own runs first, keeping the map on its way", async () => {
    const chapter = await claimedChapter();
    const unwritten = await libraryLessonFixture({ title: "Inside a cell" });

    await chapterLessonFixture({ chapterId: chapter.id, lessonId: unwritten.id, position: 1 });

    await prisma.chapterMindMap.update({
      data: { updatedAt: new Date(Date.now() - 9 * 60 * 1000) },
      where: { chapterId: chapter.id },
    });

    getStartMock().mockResolvedValue({ runId: "lesson-run" } as never);

    const writing = [true, false];

    vi.mocked(getRun).mockImplementation(
      () =>
        ({
          exists: Promise.resolve(true),
          status: Promise.resolve(writing.shift() ? "running" : "completed"),
        }) as never,
    );

    vi.mocked(sleep).mockImplementation(async () => {
      const held = await prisma.chapterMindMap.findUniqueOrThrow({
        where: { chapterId: chapter.id },
      });

      expect(held).toMatchObject({ runId: "test-run-id", status: "running" });
      expect(Date.now() - held.updatedAt.getTime()).toBeLessThan(60 * 1000);

      await prisma.lesson.update({
        data: { contentStatus: "completed" },
        where: { id: unwritten.id },
      });
    });

    await expect(
      chapterMindMapWorkflow({
        chapterId: chapter.id,
        lessons: { forExam: true, ids: [unwritten.id] },
      }),
    ).resolves.toStrictEqual({ hasImage: true });

    expect(getStartMock()).toHaveBeenCalledExactlyOnceWith(
      lessonContentWorkflow,
      [{ analytics: undefined, forExam: true, lessonId: unwritten.id, wait: "learner" }],
      { experimental_hook: { token: `lesson-content:${unwritten.id}` } },
    );

    expect(sleep).toHaveBeenCalledOnce();

    expect(generateMindMapStructure).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        chapter: expect.objectContaining({
          lessons: [
            expect.objectContaining({ title: "What a cell is" }),
            expect.objectContaining({ title: "Inside a cell" }),
          ],
        }),
      }),
    );
  });

  it("shows the map as soon as its picture is drawn, then checks its words", async () => {
    const chapter = await claimedChapter();

    vi.mocked(checkMindMapImage).mockImplementation(async ({ image }) => {
      await expect(
        prisma.chapterMindMap.findUniqueOrThrow({ where: { chapterId: chapter.id } }),
      ).resolves.toMatchObject({ imageUrl: expect.any(String), status: "completed" });

      expect(image.data.byteLength).toBeGreaterThan(0);
      return passedMapCheck;
    });

    await expect(chapterMindMapWorkflow({ chapterId: chapter.id })).resolves.toStrictEqual({
      hasImage: true,
    });

    expect(checkMindMapImage).toHaveBeenCalledOnce();
    expect(generateMindMapImage).toHaveBeenCalledOnce();

    await expect(
      prisma.chapterMindMap.findUniqueOrThrow({ where: { chapterId: chapter.id } }),
    ).resolves.toMatchObject({
      imageModel: imageProvenance.model,
      runId: "test-run-id",
      status: "completed",
      structure,
    });
  });

  it("draws the picture again when its check finds a serious mistake and replaces it", async () => {
    const chapter = await claimedChapter();
    const shown: (string | null)[] = [];

    vi.mocked(checkMindMapImage).mockImplementation(async () => {
      const row = await prisma.chapterMindMap.findUniqueOrThrow({
        where: { chapterId: chapter.id },
      });

      shown.push(row.imageUrl);
      return shown.length === 1 ? failedMapCheck : passedMapCheck;
    });

    await expect(chapterMindMapWorkflow({ chapterId: chapter.id })).resolves.toStrictEqual({
      hasImage: true,
    });

    expect(vi.mocked(generateMindMapImage).mock.calls[1]?.[0]).toMatchObject({
      corrections: failedMapCheck.data.problems,
    });

    const [first, second] = shown;
    expect(second).not.toBe(first);

    await expect(
      prisma.chapterMindMap.findUniqueOrThrow({ where: { chapterId: chapter.id } }),
    ).resolves.toMatchObject({ imageUrl: second, status: "completed" });
  });

  it("keeps only the outline when the second picture fails its check too", async () => {
    const chapter = await claimedChapter();
    vi.mocked(checkMindMapImage).mockResolvedValue(failedMapCheck);

    await expect(chapterMindMapWorkflow({ chapterId: chapter.id })).resolves.toStrictEqual({
      hasImage: false,
    });

    expect(generateMindMapImage).toHaveBeenCalledTimes(2);

    await expect(
      prisma.chapterMindMap.findUniqueOrThrow({ where: { chapterId: chapter.id } }),
    ).resolves.toMatchObject({
      imageUrl: null,
      status: "completed",
      structure,
      thumbnailUrl: null,
    });
  });

  it("marks the map failed when its run fails before it's shown, so the learner can ask again", async () => {
    const chapter = await claimedChapter();
    vi.mocked(generateMindMapImage).mockRejectedValue(new Error("The image model is down."));

    await expect(chapterMindMapWorkflow({ chapterId: chapter.id })).rejects.toThrow(
      "The image model is down.",
    );

    await expect(
      prisma.chapterMindMap.findUniqueOrThrow({ where: { chapterId: chapter.id } }),
    ).resolves.toMatchObject({ status: "failed", structure });
  });

  it("never retries a drawn picture its storage refused, which would pay to draw it again", async () => {
    const chapter = await claimedChapter();

    vi.mocked(uploadImage).mockResolvedValue({
      data: null,
      error: new Error("The private Blob store isn't configured"),
    });

    const run = chapterMindMapWorkflow({ chapterId: chapter.id });

    await expect(run).rejects.toBeInstanceOf(FatalError);
    expect(generateMindMapImage).toHaveBeenCalledOnce();

    await expect(
      prisma.chapterMindMap.findUniqueOrThrow({ where: { chapterId: chapter.id } }),
    ).resolves.toMatchObject({ imageUrl: null, status: "failed" });
  });

  it("keeps the shown map when its check can't run", async () => {
    const chapter = await claimedChapter();
    vi.mocked(checkMindMapImage).mockRejectedValue(new Error("The reader is down."));

    await expect(chapterMindMapWorkflow({ chapterId: chapter.id })).rejects.toThrow(
      "The reader is down.",
    );

    await expect(
      prisma.chapterMindMap.findUniqueOrThrow({ where: { chapterId: chapter.id } }),
    ).resolves.toMatchObject({ imageUrl: expect.any(String), status: "completed" });
  });
});
