import { randomUUID } from "node:crypto";
import { type APIRequestContext } from "@playwright/test";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { getBaseUrl } from "@zoonk/utils/origin";
import { normalizeString } from "@zoonk/utils/string";
import { type Page, expect, test } from "./fixtures";

const OPEN_GRAPH_IMAGE_SIZE = { height: 630, width: 1200 };

/**
 * Playwright workers do not run through Next.js's environment loader, so load
 * the app's `.env` file before resolving the same base URL used during builds.
 */
function getExpectedMetadataBase() {
  process.loadEnvFile();
  return getBaseUrl();
}

/**
 * The generated route returns PNG bytes, so this reads the PNG header directly
 * instead of depending on browser rendering details or snapshot files.
 */
function getPngSize(image: Buffer): { height: number; width: number } {
  return { height: image.readUInt32BE(20), width: image.readUInt32BE(16) };
}

/**
 * Catalog pages need route-specific social cards, so the simplest end-to-end
 * proof is asking the metadata route for an image and checking the actual bytes.
 */
async function expectGeneratedOpenGraphImage({
  path,
  request,
}: {
  path: string;
  request: APIRequestContext;
}) {
  const response = await request.get(path);
  const image = await response.body();

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(getPngSize(image)).toStrictEqual(OPEN_GRAPH_IMAGE_SIZE);
}

/**
 * Next fingerprints generated metadata routes, so tests need to read the
 * concrete image URL from the page head instead of guessing the file route.
 */
async function getOpenGraphImageUrl({ page, path }: { page: Page; path: string }) {
  await page.goto(path);

  const imageUrl = await page.evaluate(
    () => document.querySelector<HTMLMetaElement>("meta[property='og:image']")?.content ?? "",
  );

  return new URL(imageUrl, "http://localhost");
}

/**
 * Metadata image routes include a build fingerprint, so callers need the full
 * path and query string when requesting the generated image from the test app.
 */
async function getOpenGraphImagePath({ page, path }: { page: Page; path: string }) {
  const url = await getOpenGraphImageUrl({ page, path });
  return `${url.pathname}${url.search}`;
}

test("uses the current app origin for the shared open graph image", async ({ page, request }) => {
  const imageUrl = await getOpenGraphImageUrl({ page, path: "/" });

  expect(imageUrl.origin).toBe(getExpectedMetadataBase());

  await expectGeneratedOpenGraphImage({ path: `${imageUrl.pathname}${imageUrl.search}`, request });
});

test("generates route-specific open graph images for catalog pages", async ({ page, request }) => {
  const uniqueId = randomUUID().slice(0, 8);
  const org = await getAiOrganization();
  const courseTitle = `E2E Open Graph Course ${uniqueId}`;
  const chapterTitle = `E2E Open Graph Chapter ${uniqueId}`;
  const lessonTitle = `E2E Open Graph Lesson ${uniqueId}`;

  const course = await courseFixture({
    description: `A social sharing course ${uniqueId}`,
    imageUrl: "/catalog/chapters/tech.webp",
    isPublished: true,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: org.id,
    slug: `e2e-og-course-${uniqueId}`,
    title: courseTitle,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    description: `A social sharing chapter ${uniqueId}`,
    imageUrl: "/catalog/chapters/science.webp",
    isPublished: true,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: org.id,
    position: 0,
    slug: `e2e-og-chapter-${uniqueId}`,
    title: chapterTitle,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `A social sharing lesson ${uniqueId}`,
    imageUrl: "/catalog/lessons/explanation.webp",
    isPublished: true,
    kind: "explanation",
    normalizedTitle: normalizeString(lessonTitle),
    organizationId: org.id,
    position: 0,
    slug: `e2e-og-lesson-${uniqueId}`,
    title: lessonTitle,
  });

  const coursePath = `/b/${org.slug}/c/${course.slug}`;
  const chapterPath = `${coursePath}/ch/${chapter.slug}`;
  const lessonPath = `${chapterPath}/l/${lesson.slug}`;

  const courseImagePath = await getOpenGraphImagePath({ page, path: coursePath });
  const chapterImagePath = await getOpenGraphImagePath({ page, path: chapterPath });
  const lessonImagePath = await getOpenGraphImagePath({ page, path: lessonPath });

  await Promise.all([
    expectGeneratedOpenGraphImage({ path: courseImagePath, request }),
    expectGeneratedOpenGraphImage({ path: chapterImagePath, request }),
    expectGeneratedOpenGraphImage({ path: lessonImagePath, request }),
  ]);
});
