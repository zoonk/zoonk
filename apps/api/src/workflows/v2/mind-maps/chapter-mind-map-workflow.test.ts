import { randomUUID } from "node:crypto";
import { checkMindMapImage } from "@zoonk/ai/tasks/v2/mind-maps/check";
import { generateMindMapImage } from "@zoonk/ai/tasks/v2/mind-maps/image";
import { generateMindMapStructure } from "@zoonk/ai/tasks/v2/mind-maps/structure";
import { uploadImage } from "@zoonk/core/images/upload";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FatalError } from "workflow";
import { TEST_IMAGE, imageProvenance } from "../images/_test-utils/image-results";
import { chapterMindMapWorkflow } from "./chapter-mind-map-workflow";

/** Models and Vercel Blob are the external boundaries; the map's row and the claim run for real. */
vi.mock("@zoonk/ai/tasks/v2/mind-maps/structure", () => ({ generateMindMapStructure: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/mind-maps/image", () => ({ generateMindMapImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/mind-maps/check", () => ({ checkMindMapImage: vi.fn() }));
vi.mock("@zoonk/core/images/upload", () => ({ uploadImage: vi.fn() }));

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

/** The check reads the stored picture back by its URL, which the Blob mock makes up. */
function serveStoredPictures() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(TEST_IMAGE, { headers: { "content-type": "image/webp" } })),
  );
}

/** A chapter with a written lesson whose map a learner's request just claimed. */
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

  it("shows the map as soon as its picture is drawn, then checks its words", async () => {
    const chapter = await claimedChapter();

    // The check reads the stored picture after learners can already see it.
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

    // The second drawing is told what the check found, and its picture replaced the first.
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

    // The text written before the failure stays, so asking again only draws the picture.
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

    // A fatal error: the workflow doesn't run the step again, so the picture is drawn once.
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
