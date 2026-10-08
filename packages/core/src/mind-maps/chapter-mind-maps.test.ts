import { randomUUID } from "node:crypto";
import { checkMindMapImage } from "@zoonk/ai/tasks/v2/mind-maps/check";
import { generateMindMapImage } from "@zoonk/ai/tasks/v2/mind-maps/image";
import { type MindMapStructure } from "@zoonk/ai/tasks/v2/mind-maps/schema";
import { generateMindMapStructure } from "@zoonk/ai/tasks/v2/mind-maps/structure";
import { prisma } from "@zoonk/db";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { readStoredImage } from "../images/read-stored-image";
import { uploadImage } from "../images/upload-image";
import { drawTestImage } from "../library/media/_test-utils/image-mocks";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import {
  checkChapterMindMapImage,
  drawChapterMindMap,
  failChapterMindMap,
  removeChapterMindMapImage,
  showChapterMindMap,
  writeChapterMindMapStructure,
} from "./chapter-mind-map-generation";
import { getChapterMindMap } from "./get-chapter-mind-map";
import { listGoalMindMaps } from "./list-goal-mind-maps";
import { requestChapterMindMap } from "./request-chapter-mind-map";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

/** Models and Vercel Blob are the external boundaries; rows, claims and files' sizes run for real. */
vi.mock("@zoonk/ai/tasks/v2/mind-maps/structure", () => ({ generateMindMapStructure: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/mind-maps/image", () => ({ generateMindMapImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/mind-maps/check", () => ({ checkMindMapImage: vi.fn() }));
vi.mock("../images/upload-image", () => ({ uploadImage: vi.fn() }));
vi.mock("../images/read-stored-image", () => ({ readStoredImage: vi.fn() }));

const structure: MindMapStructure = {
  branches: [
    {
      drawing: "an atom",
      explanation: "Everything is made of tiny atoms.",
      points: ["Too small to see"],
      title: "Atoms",
    },
    {
      drawing: "a nucleus",
      explanation: "The heavy center of an atom.",
      points: ["Holds protons"],
      title: "Nucleus",
    },
    {
      drawing: "an electron",
      explanation: "Light charges around the nucleus.",
      points: ["Negative charge"],
      title: "Electrons",
    },
  ],
  centralIdea: "Matter is made of atoms with a nucleus and electrons.",
  comparison: null,
  summary: "Atoms have a heavy nucleus and light electrons.",
  title: "The very small world",
};

const provenance = {
  generatedAt: "2026-10-07T12:00:00.000Z",
  latencyMs: 1000,
  model: "anthropic/claude-haiku-5.5",
  promptVersion: "test",
  provider: "anthropic",
  requestedModel: "anthropic/claude-haiku-5.5",
  runId: "test-run",
  usage: {},
};

const passed = {
  data: { missing: [], passed: true, problems: [], transcript: [], unknown: [] },
  provenance,
};

const failed = {
  data: {
    missing: [],
    passed: false,
    problems: ["words that aren't in the map's text: 'atmos'"],
    transcript: ["Atmos"],
    unknown: ["atmos"],
  },
  provenance,
};

/**
 * A learner who finished the first chapter (two lessons) of their course goal and is in the
 * second. `written` writes the first chapter's lessons, which a map is drawn from.
 */
async function finishedChapter({ written = true }: { written?: boolean } = {}) {
  const fixture = await signedInCourseGoal({ statuses: ["done", "done", "todo", "todo"] });
  const [finished, current] = fixture.chapters;
  const firstLessons = fixture.lessons.slice(0, 2);

  if (written) {
    await Promise.all([
      prisma.lesson.updateMany({
        data: { contentStatus: "completed", summary: { ideas: [{ text: "Atoms are tiny." }] } },
        where: { id: { in: firstLessons.map((lesson) => lesson.id) } },
      }),
      libraryStepFixture({
        content: { text: "Everything around you is made of atoms.", title: "Atoms" },
        kind: "explanation",
        lessonId: firstLessons[0]?.id ?? "",
        position: 0,
      }),
    ]);
  }

  return { ...fixture, current: current?.id ?? "", finished: finished?.id ?? "" };
}

function runAnalytics() {
  return { runId: `run-${randomUUID()}` };
}

describe("chapter mind maps", () => {
  beforeEach(async () => {
    const image = new Uint8Array(await drawTestImage());

    vi.mocked(generateMindMapStructure).mockResolvedValue({
      data: structure,
      provenance,
      systemPrompt: "",
      userPrompt: "",
    });

    vi.mocked(generateMindMapImage).mockResolvedValue({
      data: { image, mediaType: "image/webp" },
      prompt: "",
      provenance: { ...provenance, model: "openai/gpt-image-2.5-flare" },
    });

    vi.mocked(checkMindMapImage).mockResolvedValue(passed);
    vi.mocked(readStoredImage).mockResolvedValue({ data: image, mediaType: "image/webp" });

    vi.mocked(uploadImage).mockImplementation(({ fileName }) =>
      Promise.resolve({ data: `https://blob.test/${fileName}-${randomUUID()}`, error: null }),
    );
  });

  it("offers a map only for a finished chapter whose lessons are written, to its own learner", async () => {
    const { current, finished, goal } = await finishedChapter({ written: false });

    await expect(getChapterMindMap({ chapterId: current })).resolves.toMatchObject({
      mindMap: { image: null, outline: null, position: 2, status: "unavailable" },
      status: "ready",
    });

    // Finished, but nothing written to draw a map from (skipped with its test, say).
    await expect(getChapterMindMap({ chapterId: finished })).resolves.toMatchObject({
      mindMap: { status: "unavailable" },
    });

    await expect(
      requestChapterMindMap({ chapterId: finished, goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "unavailable" });

    await prisma.lesson.updateMany({
      data: { contentStatus: "completed" },
      where: { chapters: { some: { chapterId: finished } } },
    });

    await expect(getChapterMindMap({ chapterId: finished })).resolves.toStrictEqual({
      mindMap: {
        chapterId: finished,
        image: null,
        outline: null,
        position: 1,
        status: "available",
        title: "The very small world",
      },
      status: "ready",
    });

    const other = await userFixture();
    mockSession(other.id);

    await expect(
      getChapterMindMap({ chapterId: finished, goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      requestChapterMindMap({ chapterId: finished, goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);

    await expect(getChapterMindMap({ chapterId: finished })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("counts a new map toward the learner's mind map limits once, and a second ask joins the run", async () => {
    const { current, finished, goal, user } = await finishedChapter();

    await expect(
      requestChapterMindMap({ chapterId: finished, goalId: goal.id }),
    ).resolves.toMatchObject({
      analytics: { distinctId: user.id, goalId: goal.id },
      status: "start",
    });

    await expect(
      prisma.chapterMindMap.findUniqueOrThrow({ where: { chapterId: finished } }),
    ).resolves.toMatchObject({ language: "en", status: "running" });

    await expect(
      requestChapterMindMap({ chapterId: finished, goalId: goal.id }),
    ).resolves.toStrictEqual({ generationId: null, status: "generating" });

    await expect(getChapterMindMap({ chapterId: finished })).resolves.toMatchObject({
      mindMap: { status: "generating" },
    });

    await expect(
      prisma.usageRecord.findMany({ select: { targetId: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ targetId: finished }]);

    await expect(
      requestChapterMindMap({ chapterId: current, goalId: goal.id }),
    ).resolves.toStrictEqual({ status: "unavailable" });
  });

  it("writes and draws the map once, then every learner of the chapter reads it", async () => {
    const { current, finished, goal } = await finishedChapter();
    const analytics = runAnalytics();

    await requestChapterMindMap({ chapterId: finished, goalId: goal.id });
    await writeChapterMindMapStructure({ analytics, chapterId: finished });

    // The structure is written from the chapter's written lessons, in the chapter's language.
    expect(generateMindMapStructure).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        analytics: expect.objectContaining({ contentScope: "shared", traceId: analytics.runId }),
        chapter: expect.objectContaining({
          language: "en",
          lessons: [
            expect.objectContaining({
              screens: [{ text: "Everything around you is made of atoms.", title: "Atoms" }],
              summary: ["Atoms are tiny."],
            }),
            expect.objectContaining({ screens: [] }),
          ],
          title: "The very small world",
        }),
      }),
    );

    // Drawing stores nothing: storing is its own step, so a store that fails never pays for the
    // drawing again.
    const drawn = await drawChapterMindMap({ analytics, chapterId: finished });
    expect(uploadImage).not.toHaveBeenCalled();
    await showChapterMindMap({ chapterId: finished, drawn });

    // Public chapters' maps go to the Library's public folder, with a small copy for lists.
    expect(
      vi.mocked(uploadImage).mock.calls.map(([upload]) => [upload.access, upload.fileName]),
    ).toStrictEqual([
      ["public", "library/mind-maps/mind-map.webp"],
      ["public", "library/mind-maps/mind-map-thumb.webp"],
    ]);

    const result = await getChapterMindMap({ chapterId: finished });
    const mindMap = result.status === "ready" ? result.mindMap : null;

    expect(mindMap?.status).toBe("ready");
    expect(mindMap?.image).toMatchObject({ height: 32, width: 48 });
    expect(mindMap?.image?.thumbnailUrl).toMatch(/mind-map-thumb\.webp/u);

    // Learners read the map's words, never the sketches the picture draws.
    expect(mindMap?.outline?.branches[0]).toStrictEqual({
      explanation: "Everything is made of tiny atoms.",
      points: ["Too small to see"],
      title: "Atoms",
    });

    await expect(listGoalMindMaps()).resolves.toMatchObject({
      mindMaps: {
        chapters: [
          { chapterId: finished, position: 1, status: "ready", title: "The very small world" },
        ],
        goal: { id: goal.id },
      },
      status: "ready",
    });

    // Another learner who finished the same chapter gets the same map, with nothing to make.
    const other = await signedInCourseGoal({ statuses: ["done", "done", "todo", "todo"] });

    await prisma.planItem.updateMany({
      data: { chapterId: finished },
      where: { chapterId: other.chapters[0]?.id, planId: other.plan.id },
    });

    await expect(
      requestChapterMindMap({ chapterId: finished, goalId: other.goal.id }),
    ).resolves.toStrictEqual({ status: "ready" });

    expect(generateMindMapStructure).toHaveBeenCalledOnce();

    // Reading a map that exists never counts toward their limits.
    await expect(prisma.usageRecord.count({ where: { userId: other.user.id } })).resolves.toBe(0);
    expect(current).not.toBe(finished);
  });

  it("shows the picture before its check, replaces it after a failed one, and keeps the words when the new one fails too", async () => {
    const { finished, goal } = await finishedChapter();
    const analytics = runAnalytics();

    await requestChapterMindMap({ chapterId: finished, goalId: goal.id });
    await writeChapterMindMapStructure({ analytics, chapterId: finished });

    await showChapterMindMap({
      chapterId: finished,
      drawn: await drawChapterMindMap({ analytics, chapterId: finished }),
    });

    // Ready with its picture before anything checked it.
    expect(checkMindMapImage).not.toHaveBeenCalled();

    const shown = await getChapterMindMap({ chapterId: finished });
    const firstUrl = shown.status === "ready" ? shown.mindMap.image?.url : null;
    expect(firstUrl).toMatch(/mind-map\.webp/u);

    // The check reads the stored picture back and quotes what's wrong.
    vi.mocked(checkMindMapImage).mockResolvedValue(failed);

    await expect(
      checkChapterMindMapImage({ analytics, chapterId: finished }),
    ).resolves.toStrictEqual({
      imageUrl: expect.stringContaining("mind-map.webp"),
      passed: false,
      problems: failed.data.problems,
    });

    expect(readStoredImage).toHaveBeenCalledWith({ url: expect.stringContaining("mind-map.webp") });

    // Drawn again with those corrections, the new picture replaces the old one at once.
    await showChapterMindMap({
      chapterId: finished,
      drawn: await drawChapterMindMap({
        analytics,
        chapterId: finished,
        corrections: failed.data.problems,
      }),
    });

    expect(vi.mocked(generateMindMapImage).mock.calls[1]?.[0]).toMatchObject({
      corrections: failed.data.problems,
    });

    const replaced = await getChapterMindMap({ chapterId: finished });
    const secondUrl = replaced.status === "ready" ? replaced.mindMap.image?.url : null;
    expect(secondUrl).not.toBe(firstUrl);

    // Taking the first picture off again does nothing: the map shows the second.
    await removeChapterMindMapImage({ chapterId: finished, imageUrl: firstUrl ?? "" });

    await expect(getChapterMindMap({ chapterId: finished })).resolves.toMatchObject({
      mindMap: { image: { url: secondUrl } },
    });

    await removeChapterMindMapImage({ chapterId: finished, imageUrl: secondUrl ?? "" });

    await expect(getChapterMindMap({ chapterId: finished })).resolves.toMatchObject({
      mindMap: { image: null, outline: { title: "The very small world" }, status: "ready" },
    });

    // Nothing left to check.
    await expect(
      checkChapterMindMapImage({ analytics, chapterId: finished }),
    ).resolves.toStrictEqual({ imageUrl: null, passed: true, problems: [] });
  });

  it("refuses a new map once a free learner made the day's maps", async () => {
    const { finished, goal, user } = await finishedChapter();

    await prisma.usageRecord.createMany({
      data: Array.from({ length: 3 }, () => ({
        generated: true,
        kind: "mindMap" as const,
        targetId: randomUUID(),
        userId: user.id,
      })),
    });

    await expect(
      requestChapterMindMap({ chapterId: finished, goalId: goal.id }),
    ).resolves.toStrictEqual({
      decision: {
        limit: { limit: 3, period: "day", resource: "mindMap", tier: "free" },
        status: "limitReached",
      },
      status: "refused",
    });

    // Nothing was claimed, so the map isn't being made.
    await expect(getChapterMindMap({ chapterId: finished })).resolves.toMatchObject({
      mindMap: { status: "available" },
    });
  });

  it("lets the learner ask again after a run failed or stopped", async () => {
    const { finished, goal } = await finishedChapter();

    await requestChapterMindMap({ chapterId: finished, goalId: goal.id });
    await failChapterMindMap({ chapterId: finished, runId: "another-run" });

    await expect(getChapterMindMap({ chapterId: finished })).resolves.toMatchObject({
      mindMap: { status: "failed" },
    });

    await expect(
      requestChapterMindMap({ chapterId: finished, goalId: goal.id }),
    ).resolves.toMatchObject({ status: "start" });

    // A run that stopped without saying so (a deploy) counts as failed after ten minutes.
    await prisma.chapterMindMap.update({
      data: { updatedAt: new Date(Date.now() - 11 * 60 * 1000) },
      where: { chapterId: finished },
    });

    await expect(getChapterMindMap({ chapterId: finished })).resolves.toMatchObject({
      mindMap: { status: "failed" },
    });

    await expect(
      requestChapterMindMap({ chapterId: finished, goalId: goal.id }),
    ).resolves.toMatchObject({ status: "start" });
  });
});
