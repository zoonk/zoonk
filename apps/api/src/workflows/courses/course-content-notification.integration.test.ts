import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { start } from "workflow/api";
import { courseDetailsWorkflow } from "./course-details-workflow";

const realFetch = globalThis.fetch;

describe("durable Main cache notification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("retries only delivery after course details have committed", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({
        description: "Learn English",
        landingPage: { valueProposition: "Practice English" },
        targetLanguage: "en",
        visibility: "public",
      }),
      libraryChapterFixture(),
    ]);

    await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });
    vi.stubEnv("ZOONK_APP", "api");
    vi.stubEnv("APP_CACHE_SECRET", "test-secret");
    const deliveries: Date[] = [];
    const firstResponse = Promise.withResolvers<null>();
    onTestFinished(() => firstResponse.resolve(null));

    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);

      if (url.pathname !== "/api/cache/tags") {
        return realFetch(input, init);
      }

      const stored = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
      deliveries.push(stored.updatedAt);

      if (deliveries.length === 1) {
        await firstResponse.promise;
      }

      return new Response(null, { status: deliveries.length === 1 ? 503 : 200 });
    });

    const run = await start(courseDetailsWorkflow, [{ courseId: course.id }]);
    await expect(run.returnValue).resolves.toMatchObject({ details: "written" });
    firstResponse.resolve(null);
    await vi.waitFor(() => expect(deliveries).toHaveLength(2), { interval: 50, timeout: 15_000 });
    expect(deliveries[1]).toStrictEqual(deliveries[0]);

    await expect(
      prisma.courseCategory.findMany({ where: { courseId: course.id } }),
    ).resolves.toHaveLength(1);
  });
});
