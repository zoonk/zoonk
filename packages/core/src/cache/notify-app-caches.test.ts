import { type Server, createServer } from "node:http";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { logError } from "@zoonk/utils/logger";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCourseSlugForTitle } from "../courses/course-slug";
import { finishCourseOutline } from "../library/curriculum/course-outline-state";
import { APP_CACHE_SECRET_HEADER } from "./app-cache-contract";
import { notifyAppCaches } from "./notify-app-caches";
import { revalidateCacheTags } from "./revalidate-cache-tags";

const servers: Server[] = [];

async function endpoint(statuses: readonly number[]) {
  const requests: { body: unknown; method?: string; secret?: string | string[]; url?: string }[] =
    [];

  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }

    requests.push({
      body: JSON.parse(Buffer.concat(chunks).toString()),
      method: request.method,
      secret: request.headers[APP_CACHE_SECRET_HEADER],
      url: request.url,
    });

    response.writeHead(statuses[Math.min(requests.length - 1, statuses.length - 1)] ?? 200);
    response.end();
  });

  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected HTTP address");
  }

  vi.stubEnv("MAIN_CACHE_URL", `http://127.0.0.1:${address.port}`);
  vi.stubEnv("APP_CACHE_SECRET", "local-cache-test-secret");
  return requests;
}

describe(notifyAppCaches, () => {
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          }),
      ),
    );

    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.mocked(after).mockReset();
  });

  it("sends the shared request shape to Main and retries transient failure", async () => {
    const requests = await endpoint([503, 200]);
    await notifyAppCaches(["course:test", "catalog-courses", "course:test"]);

    expect(requests).toStrictEqual(
      Array.from({ length: 2 }, () => ({
        body: { tags: ["course:test", "catalog-courses"] },
        method: "POST",
        secret: "local-cache-test-secret",
        url: "/api/cache/tags",
      })),
    );
  });

  it("bounds failed retries, logs the failure, and preserves caller success", async () => {
    const requests = await endpoint([503]);
    await expect(notifyAppCaches(["course:test"])).resolves.toBeUndefined();
    expect(requests).toHaveLength(3);

    expect(logError).toHaveBeenCalledWith(
      "Main cache notification failed",
      expect.stringContaining("503"),
    );
  });

  it("deduplicates large invalidations and delivers every bounded partition", async () => {
    const requests = await endpoint([200]);
    const tags = Array.from({ length: 257 }, (_, index) => `course:partition-${index}`);
    await notifyAppCaches([...tags, ...tags]);

    expect(requests.map((request) => request.body)).toStrictEqual([
      { tags: tags.slice(0, 128) },
      { tags: tags.slice(128, 256) },
      { tags: tags.slice(256) },
    ]);

    expect(logError).not.toHaveBeenCalled();
  });

  it("continues later partitions after one exhausts its bounded retries", async () => {
    const requests = await endpoint([200, 503, 503, 503, 200]);
    const tags = Array.from({ length: 257 }, (_, index) => `course:partition-${index}`);
    await expect(notifyAppCaches(tags)).resolves.toBeUndefined();

    expect(requests.map((request) => request.body)).toStrictEqual([
      { tags: tags.slice(0, 128) },
      ...Array.from({ length: 3 }, () => ({ tags: tags.slice(128, 256) })),
      { tags: tags.slice(256) },
    ]);

    expect(logError).toHaveBeenCalledOnce();
  });

  it("does not retry unauthorized requests or throw for malformed configuration", async () => {
    const requests = await endpoint([401]);
    await expect(notifyAppCaches(["course:test"])).resolves.toBeUndefined();
    expect(requests).toHaveLength(1);
    vi.stubEnv("MAIN_CACHE_URL", "not-a-url");
    await expect(notifyAppCaches(["course:test"])).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it("expires all local tags once and defers only shared content to Main", async () => {
    const requests = await endpoint([200]);
    const deferred: (() => unknown)[] = [];

    // Next request lifetimes are the platform boundary; the HTTP delivery runs for real.
    vi.mocked(after).mockImplementation((task) => {
      if (typeof task === "function") {
        deferred.push(task);
      }
    });

    const shared = [
      "course:test",
      "course-route:brand:course",
      "course-curriculum:test",
      "library-chapter:test",
      "library-lesson:test",
      "skill:test",
      "media-asset:test",
      "exam-blueprint:test",
      "catalog-courses",
    ];

    const privateTags = [
      "user-progress:test",
      "user-session:test",
      "user-subscription:test",
      "learner-model:test",
      "learning-profile:test",
      "allowance:test",
      "memory:test",
      "goals:test",
      "instrument-waitlist:test",
      "unknown:test",
      "courseware:test",
    ];

    expect(() => revalidateCacheTags([...shared, ...privateTags, shared[0] ?? ""])).not.toThrow();
    expect(revalidateTag).toHaveBeenCalledTimes(shared.length + privateTags.length);
    expect(revalidateTag).toHaveBeenCalledWith("user-session:test", { expire: 0 });
    expect(deferred).toHaveLength(1);
    expect(requests).toHaveLength(0);
    await Promise.all(deferred.map((task) => task()));
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toStrictEqual({ tags: shared });
  });

  it("never forwards from Main, or when either sender setting is missing", async () => {
    const requests = await endpoint([200]);
    vi.stubEnv("MAIN_CACHE_URL", "");
    revalidateCacheTags(["course:test"]);
    expect(after).not.toHaveBeenCalled();
    vi.stubEnv("MAIN_CACHE_URL", "http://127.0.0.1:1");
    vi.stubEnv("APP_CACHE_SECRET", "");
    revalidateCacheTags(["course:test"]);
    expect(after).not.toHaveBeenCalled();
    expect(requests).toHaveLength(0);
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });

  it("does not schedule private-only invalidations even in a configured sender", async () => {
    const requests = await endpoint([200]);
    revalidateCacheTags(["goals:test", "learner-model:test", "memory:test"]);
    expect(after).not.toHaveBeenCalled();
    expect(requests).toHaveLength(0);
    expect(revalidateTag).toHaveBeenCalledTimes(3);
  });

  it("falls back when after is unavailable without throwing failed delivery into the write", async () => {
    const requests = await endpoint([503]);

    vi.mocked(after).mockImplementation(() => {
      throw new Error("after outside a request scope");
    });

    expect(() => revalidateCacheTags(["course:test"])).not.toThrow();
    expect(revalidateTag).toHaveBeenCalledWith("course:test", { expire: 0 });

    await vi.waitFor(() => {
      expect(requests).toHaveLength(3);

      expect(logError).toHaveBeenCalledWith(
        "Main cache notification failed",
        expect.stringContaining("503"),
      );
    });
  });

  it.each([
    { failures: 0, requestsCount: 2, status: 200 },
    { failures: 2, requestsCount: 6, status: 503 },
  ])(
    "forwards an existing real-DB publication, preserving success on HTTP $status",
    async ({ failures, requestsCount, status }) => {
      const requests = await endpoint([status]);
      const deferred: (() => unknown)[] = [];

      vi.mocked(after).mockImplementation((task) => {
        if (typeof task === "function") {
          deferred.push(task);
        }
      });

      const organization = await organizationFixture();

      const course = await courseFixture({
        isPublished: false,
        organizationId: organization.id,
        outlineRunId: "cache-hook-test",
        outlineStatus: "running",
        slug: getCourseSlugForTitle({ language: "en", title: "हिन्दी" }),
        visibility: "public",
      });

      expect(course.slug).toMatch(/\p{M}/u);

      await finishCourseOutline({
        courseId: course.id,
        status: "completed",
        workflowRunId: "cache-hook-test",
      });

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ).resolves.toMatchObject({ isPublished: true, outlineStatus: "completed" });

      expect(requests).toHaveLength(0);
      await Promise.all(deferred.map((task) => task()));

      expect(requests.map((request) => request.body)).toStrictEqual(
        expect.arrayContaining([
          {
            tags: [
              `course:${course.id}`,
              "catalog-courses",
              `course-route:${organization.slug}:${course.slug}`,
            ],
          },
        ]),
      );

      expect(requests).toHaveLength(requestsCount);
      expect(logError).toHaveBeenCalledTimes(failures);
    },
  );
});
