import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as database from "@zoonk/db";
import { prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { loadBindings, transform } from "next/dist/build/swc";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { appCacheTagsSchema } from "../cache/app-cache-contract";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import * as courseTags from "../cache/tags";
import { getCourseCacheTag, getCourseRouteCacheTag } from "../cache/tags";
import { finishCourseOutline } from "../library/curriculum/course-outline-state";
import * as routeParams from "../navigation/decode-route-param";
import { getSession } from "../users/get-session";
import { getCourse } from "./get-course-by-slug";
import { renameCourseForAdmin } from "./rename-course";

type CacheEntry = { result: Promise<unknown>; tags: Set<string> };
type CachedRead = (...args: unknown[]) => Promise<unknown>;

/**
 * Vitest doesn't compile cache directives. Use the installed Next compiler and replace only its
 * request/cache platform: one request's private entries, the app's shared entries and tag expiry.
 * All course queries and mutations still reach PostgreSQL. This checks our capability's cache
 * boundary and dependencies; the app's instant-navigation E2E checks actual Next prefetching.
 */
function courseCachePlatform(code: string) {
  const sharedEntries = new Map<string, CacheEntry>();
  const requestEntries = new Map<string, CacheEntry>();
  const activeTags = new AsyncLocalStorage<Set<string>>();

  function cache(kind: string, id: string, _boundArgs: number, read: CachedRead, args: unknown[]) {
    const entries = kind === "private" ? requestEntries : sharedEntries;
    const key = JSON.stringify([id, args]);
    const tags = new Set<string>();

    const entry = entries.get(key) ?? {
      result: Promise.resolve().then(() => activeTags.run(tags, () => read(...args))),
      tags,
    };

    entries.set(key, entry);

    return entry.result.then((result) => {
      entry.tags.forEach((tag) => activeTags.getStore()?.add(tag));
      return result;
    });
  }

  vi.mocked(cacheTag).mockImplementation((...tags) => {
    tags.forEach((tag) => activeTags.getStore()?.add(tag));
  });

  vi.mocked(revalidateTag).mockImplementation((tag) => {
    [sharedEntries, requestEntries].forEach((entries) => {
      entries.forEach((entry, key) => {
        if (entry.tags.has(tag)) {
          entries.delete(key);
        }
      });
    });
  });

  const compiledExports = {} as { getCourse: typeof getCourse };

  const imports: Record<string, unknown> = {
    "../cache/tags": courseTags,
    "../navigation/decode-route-param": routeParams,
    "@zoonk/db": database,
    "next/cache": { cacheLife, cacheTag },
    "private-next-rsc-cache-wrapper": { cache },
    "private-next-rsc-server-reference": { registerServerReference: (read: unknown) => read },
    react: { cache: (read: unknown) => read },
    "server-only": {},
  };

  runInNewContext(code, {
    exports: compiledExports,
    module: { exports: compiledExports },
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error(`Unexpected course-read dependency: ${name}`);
      }

      return imports[name];
    },
  });

  return { getCourse: compiledExports.getCourse, nextRequest: () => requestEntries.clear() };
}

describe(getCourse, () => {
  it("returns a published brand course with its organization and categories", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: organization.id,
    });

    await Promise.all([
      courseCategoryFixture({ category: "tech", courseId: course.id }),
      courseCategoryFixture({ category: "science", courseId: course.id }),
    ]);

    const result = await getCourse({ brandSlug: organization.slug, courseSlug: course.slug });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(course.id);
    expect(result?.title).toBe(course.title);
    expect(result?.description).toBe(course.description);
    expect(result?.organization?.name).toBe(organization.name);
    expect(result?.organization?.slug).toBe(organization.slug);
    expect(result?.categories).toHaveLength(2);

    expect(result?.categories.map((item) => item.category)).toStrictEqual(
      expect.arrayContaining(["tech", "science"]),
    );

    expect(cacheTag).toHaveBeenCalledWith(
      getCourseRouteCacheTag({ brandSlug: organization.slug, courseSlug: course.slug }),
    );

    expect(cacheTag).toHaveBeenCalledWith(getCourseCacheTag(course.id));
  });

  it("normalizes an encoded Unicode slug before reading and caching the route", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language: "pt-BR",
      organizationId: organization.id,
      slug: `japones-${crypto.randomUUID()}-日本語`,
    });

    const result = await getCourse({
      brandSlug: organization.slug,
      courseSlug: encodeURIComponent(course.slug),
    });

    expect(result?.id).toBe(course.id);

    expect(cacheTag).toHaveBeenCalledWith(
      getCourseRouteCacheTag({ brandSlug: organization.slug, courseSlug: course.slug }),
    );
  });

  it("keeps malformed route segments as not-found inputs", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    await expect(
      getCourse({ brandSlug: organization.slug, courseSlug: "%broken" }),
    ).resolves.toBeNull();

    expect(cacheTag).toHaveBeenCalledWith(
      getCourseRouteCacheTag({ brandSlug: organization.slug, courseSlug: "%broken" }),
    );
  });

  it("returns null when the course does not exist", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const result = await getCourse({
      brandSlug: organization.slug,
      courseSlug: `missing-${crypto.randomUUID()}`,
    });

    expect(result).toBeNull();
  });

  it("returns null when the course is unpublished", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: false, organizationId: organization.id });

    const result = await getCourse({ brandSlug: organization.slug, courseSlug: course.slug });

    expect(result).toBeNull();
  });

  // A course page is the same for everyone and never reads a session, so a learner's private
  // course has none, even under a brand.
  it("returns null when the course is private", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
      visibility: "private",
    });

    const result = await getCourse({ brandSlug: organization.slug, courseSlug: course.slug });

    expect(result).toBeNull();
  });

  it("returns null when the course belongs to a non-brand organization", async () => {
    const organization = await organizationFixture({ kind: "school" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const result = await getCourse({ brandSlug: organization.slug, courseSlug: course.slug });

    expect(result).toBeNull();
  });

  it("returns null when the brand slug does not match", async () => {
    const [courseOrganization, requestedOrganization] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({
      isPublished: true,
      organizationId: courseOrganization.id,
    });

    const result = await getCourse({
      brandSlug: requestedOrganization.slug,
      courseSlug: course.slug,
    });

    expect(result).toBeNull();
  });
});

describe("the complete course route cache", () => {
  const filename = new URL("get-course-by-slug.ts", import.meta.url).pathname;
  const compiled = { code: "" };

  beforeAll(async () => {
    await loadBindings();

    const result = await transform(readFileSync(filename, "utf8"), {
      filename,
      jsc: { parser: { syntax: "typescript" }, target: "es2022" },
      module: { type: "commonjs" },
      serverActions: {
        cacheKinds: ["default", "private", "remote"],
        hashSalt: "course-route-test",
        isDevelopment: false,
        isReactServerLayer: true,
        useCacheEnabled: true,
      },
    });

    compiled.code = result.code;
  });

  afterEach(() => {
    vi.mocked(cacheTag).mockReset();
    vi.mocked(revalidateTag).mockReset();
  });

  it.each(["legacy slug % value", "x".repeat(300)])(
    "uses a hook-compatible tag for a legacy route and expires the cached address on rename: %s",
    async (legacySlug) => {
      const platform = courseCachePlatform(compiled.code);

      const [organization, admin] = await Promise.all([
        organizationFixture({ kind: "brand" }),
        userFixture({ role: "admin" }),
      ]);

      const course = await courseFixture({
        isPublished: true,
        organizationId: organization.id,
        slug: legacySlug,
      });

      vi.mocked(getSession).mockResolvedValue(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the admin identity and role are read.
        { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
      );

      const params = { brandSlug: organization.slug, courseSlug: course.slug };
      const tag = getCourseRouteCacheTag(params);
      expect(appCacheTagsSchema.safeParse({ tags: [tag] }).success).toBe(true);
      await expect(platform.getCourse(params)).resolves.toMatchObject({ id: course.id });
      expect(cacheTag).toHaveBeenCalledWith(tag);

      await expect(
        renameCourseForAdmin({ courseId: course.id, slug: course.slug, title: "Legacy title" }),
      ).resolves.toMatchObject({ slug: legacySlug, status: "renamed" });

      await expect(platform.getCourse(params)).resolves.toMatchObject({ title: "Legacy title" });

      await expect(
        renameCourseForAdmin({ courseId: course.id, slug: "compatible-address", title: "Renamed" }),
      ).resolves.toMatchObject({ status: "renamed" });

      expect(revalidateTag).toHaveBeenCalledWith(tag, { expire: 0 });
      await expect(platform.getCourse(params)).resolves.toBeNull();

      await expect(
        platform.getCourse({ ...params, courseSlug: "compatible-address" }),
      ).resolves.toMatchObject({ id: course.id, title: "Renamed" });
    },
  );

  it("shares one normalized read across requests until a write expires its tags", async () => {
    const platform = courseCachePlatform(compiled.code);
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
      slug: `course-${crypto.randomUUID()}-日本語`,
    });

    const params = { brandSlug: organization.slug, courseSlug: course.slug };
    const first = await platform.getCourse(params);
    expect(first?.id).toBe(course.id);
    expect(cacheLife).toHaveBeenCalledWith("catalog");

    // A write whose tags don't reach this app shows once the catalog's lifetime ends, not before.
    await prisma.course.update({
      data: { categories: { create: { category: "languages" } }, title: "Updated elsewhere" },
      where: { id: course.id },
    });

    platform.nextRequest();

    const encoded = await platform.getCourse({
      ...params,
      courseSlug: encodeURIComponent(course.slug),
    });

    expect(encoded?.title).toBe(first?.title);
    expect(encoded?.categories).toStrictEqual(first?.categories);

    revalidateCacheTags([getCourseCacheTag(course.id)]);

    const edited = await platform.getCourse(params);
    expect(edited?.title).toBe("Updated elsewhere");
    expect(edited?.categories.map((item) => item.category)).toStrictEqual(["languages"]);

    // A rename expires the old route's tag: its address stops naming the course at once.
    await prisma.course.update({
      data: { slug: `${course.slug}-renamed` },
      where: { id: course.id },
    });

    revalidateCacheTags([getCourseRouteCacheTag(params)]);

    await expect(platform.getCourse(params)).resolves.toBeNull();

    await expect(
      platform.getCourse({ ...params, courseSlug: `${course.slug}-renamed` }),
    ).resolves.toMatchObject({ id: course.id });
  });

  it("expires a cached route miss when the real outline mutation publishes the course", async () => {
    const platform = courseCachePlatform(compiled.code);
    const organization = await organizationFixture({ kind: "brand" });
    const workflowRunId = `run-${crypto.randomUUID()}`;

    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
      outlineRunId: workflowRunId,
      outlineStatus: "running",
    });

    const params = { brandSlug: organization.slug, courseSlug: course.slug };
    await expect(platform.getCourse(params)).resolves.toBeNull();

    await finishCourseOutline({ courseId: course.id, status: "completed", workflowRunId });

    expect(revalidateTag).toHaveBeenCalledWith(getCourseRouteCacheTag(params), { expire: 0 });
    await expect(platform.getCourse(params)).resolves.toMatchObject({ id: course.id });

    platform.nextRequest();
    await expect(platform.getCourse(params)).resolves.toMatchObject({ id: course.id });

    await prisma.course.update({
      data: { title: "Changed in this app" },
      where: { id: course.id },
    });

    revalidateCacheTags([getCourseCacheTag(course.id)]);

    await expect(platform.getCourse(params)).resolves.toMatchObject({
      title: "Changed in this app",
    });
  });
});
