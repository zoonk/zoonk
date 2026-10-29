import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachChapterToCourse } from "../library/chapters/attach-course-chapter";

describe("course cache notifications", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("awaits Main's course invalidation after an API outline write", async () => {
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
    vi.stubEnv("APP_CACHE_SECRET", "test-secret");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const [course, chapter] = await Promise.all([courseFixture(), libraryChapterFixture()]);

    await attachChapterToCourse({
      chapterId: chapter.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps a committed outline write successful when Main is unreachable", async () => {
    vi.stubEnv("ZOONK_APP", "api");
    vi.stubEnv("APP_CACHE_SECRET", "test-secret");
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    const [course, chapter] = await Promise.all([courseFixture(), libraryChapterFixture()]);

    await expect(
      attachChapterToCourse({
        chapterId: chapter.id,
        courseId: course.id,
        level: "beginner",
        position: 0,
      }),
    ).resolves.toMatchObject({ courseId: course.id });

    expect(fetch).toHaveBeenCalledOnce();
  });
});
