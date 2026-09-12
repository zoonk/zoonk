import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { expect, test } from "./fixtures";
import { privateLearningCourse } from "./private-learning-fixtures";

test("a private course bookmark redirects only its owner to the canonical course", async ({
  authenticatedPage: anotherUser,
  noProgressUser,
  page: guest,
  userWithoutProgress: owner,
}) => {
  const scenario = await privateLearningCourse(noProgressUser.id);
  const bookmark = `/p/${scenario.course.id}`;

  await owner.goto(bookmark);
  await expect(owner).toHaveURL(scenario.href);

  await expect(
    owner.getByRole("heading", { exact: true, name: scenario.course.title }),
  ).toBeVisible();

  await Promise.all([guest.goto(bookmark), anotherUser.goto(bookmark)]);

  await Promise.all([
    expect(guest.getByRole("heading", { exact: true, name: "404" })).toBeVisible(),
    expect(anotherUser.getByRole("heading", { exact: true, name: "404" })).toBeVisible(),
    expect(guest.getByText(scenario.course.title)).toHaveCount(0),
    expect(anotherUser.getByText(scenario.course.title)).toHaveCount(0),
  ]);
});

test("private bookmarks reject malformed IDs and ordinary catalog courses", async ({ page }) => {
  const course = await courseFixture({ isPublished: true });
  await page.goto(`/p/${course.id}`);
  await expect(page.getByRole("heading", { exact: true, name: "404" })).toBeVisible();
  await page.goto("/p/not-a-course-id");
  await expect(page.getByRole("heading", { exact: true, name: "404" })).toBeVisible();
});

// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each API.
for (const resource of ["course", "chapter", "lesson"] as const) {
  test(`private ${resource} share images stay generic for the owner`, async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const scenario = await privateLearningCourse(noProgressUser.id);

    const routes = {
      chapter: `${scenario.href}/ch/${scenario.chapter.slug}`,
      course: scenario.href,
      lesson: scenario.lessonHref,
    };

    await page.goto(routes[resource]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
    const preview = page.locator('meta[property="og:image"]').last();
    await expect(preview).toHaveAttribute("content", /opengraph-image/u);
    const previewUrl = await preview.getAttribute("content");

    if (!previewUrl) {
      throw new Error("The catalog page has no share image URL");
    }

    // The build's metadata host is fixed; the E2E web server uses an isolated dynamic port.
    const imageUrl = new URL(previewUrl);
    const imagePath = `${imageUrl.pathname}${imageUrl.search}`;

    const [actual, generic] = await Promise.all([
      page.request.get(imagePath),
      page.request.get(imagePath.replace(scenario.course.slug, "absent-private-course")),
    ]);

    expect(actual.status()).toBe(200);
    expect(generic.status()).toBe(200);
    expect(actual.headers()["content-type"]).toContain("image/png");
    expect(await actual.body()).toEqual(await generic.body());
  });
}
