import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { revalidateTag } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postCacheTags } from "../../../../../main/src/app/api/cache/tags/route";
import { claimCourseOutlineStep } from "./steps/course-outline-steps";

describe("course cache notifications", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("delivers a durable outline step's course tags to Main before returning", async () => {
    vi.stubEnv("ZOONK_APP", "api");
    vi.stubEnv("APP_CACHE_SECRET", "test-secret");

    const fetch = vi.fn(async (url: URL, init: RequestInit) =>
      postCacheTags(new Request(url, init)),
    );

    vi.stubGlobal("fetch", fetch);
    const course = await courseFixture({ outlineStatus: "pending" });

    await expect(
      claimCourseOutlineStep({ courseId: course.id, workflowRunId: "cache-test" }),
    ).resolves.toBe("claimed");

    expect(fetch).toHaveBeenCalledOnce();
    expect(revalidateTag).toHaveBeenCalledWith(`course-curriculum:${course.id}`, { expire: 0 });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ outlineRunId: "cache-test" });
  });
});
