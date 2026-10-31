import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachChapterToCourse } from "../library/chapters/attach-course-chapter";
import { claimLibraryGeneration } from "../library/claims/generation-claim";
import { collectCourseContentTags, notifyCourseContent } from "./revalidate-course-content";

describe("course cache notifications", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("awaits Main's course invalidation after a direct API outline write", async () => {
    vi.stubEnv("ZOONK_APP", "api");
    vi.stubEnv("APP_CACHE_SECRET", "test-secret");
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const [course, chapter] = await Promise.all([courseFixture(), libraryChapterFixture()]);

    await attachChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        body: JSON.stringify({ tags: [`course-curriculum:${course.id}`] }),
        headers: expect.objectContaining({ "x-app-cache-secret": "test-secret" }),
        method: "POST",
      }),
    );
  });

  it.each(["main", "admin"])("does not send from %s", async (app) => {
    vi.stubEnv("ZOONK_APP", app);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const [course, chapter] = await Promise.all([courseFixture(), libraryChapterFixture()]);

    const result = await collectCourseContentTags(() =>
      attachChapterToCourse({
        chapterId: chapter.id,
        courseId: course.id,
        level: "beginner",
        position: 0,
      }),
    );

    expect(result.tags).toStrictEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a committed write's tags so delivery retries without repeating the write", async () => {
    vi.stubEnv("ZOONK_APP", "api");
    vi.stubEnv("APP_CACHE_SECRET", "test-secret");

    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(new Response(null, { status: 200 }));

    vi.stubGlobal("fetch", fetch);
    const [course, chapter] = await Promise.all([courseFixture(), libraryChapterFixture()]);

    const written = await collectCourseContentTags(async () => {
      const placement = await attachChapterToCourse({
        chapterId: chapter.id,
        courseId: course.id,
        level: "beginner",
        position: 0,
      });

      await attachChapterToCourse({
        chapterId: chapter.id,
        courseId: course.id,
        level: "beginner",
        position: 0,
      });

      return placement;
    });

    expect(written).toMatchObject({
      tags: [`course-curriculum:${course.id}`],
      value: { courseId: course.id },
    });

    expect(fetch).not.toHaveBeenCalled();
    await expect(notifyCourseContent(written.tags)).rejects.toThrow("offline");
    await notifyCourseContent(written.tags);
    await expect(prisma.courseChapter.count({ where: { courseId: course.id } })).resolves.toBe(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not invalidate an already-completed claim", async () => {
    const course = await courseFixture({ outlineStatus: "completed" });
    vi.stubEnv("ZOONK_APP", "api");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(
      collectCourseContentTags(() =>
        claimLibraryGeneration({
          id: course.id,
          target: "courseOutline",
          workflowRunId: "fresh-run",
        }),
      ),
    ).resolves.toStrictEqual({ tags: [], value: "completed" });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("waits through a slow Main startup and sends the preview bypass", async () => {
    vi.stubEnv("APP_CACHE_SECRET", "test-secret");
    vi.stubEnv("MAIN_CACHE_BYPASS_SECRET", "preview-bypass");
    vi.useFakeTimers();
    // AbortSignal's native timer does not follow Vitest's clock.
    vi.spyOn(AbortSignal, "timeout").mockImplementation((delay) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), delay);
      return controller.signal;
    });

    const fetch = vi.fn().mockImplementation(async (_url, init: RequestInit) => {
      await new Promise<void>((resolve, reject) => {
        setTimeout(resolve, 2500);

        init.signal?.addEventListener("abort", () => reject(new Error("Notification timed out")), {
          once: true,
        });
      });

      return new Response(null, { status: 200 });
    });

    vi.stubGlobal("fetch", fetch);
    const notified = notifyCourseContent(["course:test"]);

    await vi.advanceTimersByTimeAsync(2500);
    await expect(notified).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-vercel-protection-bypass": "preview-bypass" }),
      }),
    );
  });

  it.each([401, 503])("rejects Main's HTTP %s instead of completing delivery", async (status) => {
    vi.stubEnv("APP_CACHE_SECRET", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));

    await expect(notifyCourseContent(["course:test"])).rejects.toThrow(
      `Main cache notification returned ${status}`,
    );
  });
});
