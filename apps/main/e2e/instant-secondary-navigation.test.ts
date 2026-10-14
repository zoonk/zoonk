import { instant } from "@next/playwright";
import { type Locator, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

async function expectPainted(page: Page) {
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  // Skeleton markers are the rendering contract exercised by instant(), not a control locator.
  await expect(main.locator('[data-slot="skeleton"]')).toHaveCount(0);
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await expectPainted(page);
}

/** Select a visible accessible link by its product destination, including fixture-owned IDs. */
async function destination({
  page,
  prefix,
  region = page.getByRole("main"),
}: {
  page: Page;
  prefix: string;
  region?: Locator;
}) {
  const links = await region.getByRole("link").filter({ visible: true }).all();

  const hrefs = await Promise.all(
    links.map(async (link) => ({ href: await link.getAttribute("href"), link })),
  );

  for (const { link, href } of hrefs) {
    if (href && new URL(href, page.url()).pathname.startsWith(prefix)) {
      return link;
    }
  }

  throw new Error(`No visible link to ${prefix} on ${page.url()}`);
}

async function follow({ page, link }: { page: Page; link: Locator }) {
  const href = await link.getAttribute("href");
  expect(href).not.toBeNull();
  await link.scrollIntoViewIfNeeded();
  // This test specifically requires a landed prefetch, as the existing instant-navigation suite does.
  await page.waitForLoadState("networkidle");

  await instant(page, async () => {
    await link.click();
    await page.waitForURL(new URL(href!, page.url()).href);
    await expectPainted(page);
  });
}

test.describe("Instant secondary navigation", () => {
  test("statistics tabs paint their complete prefetched content", async ({
    authenticatedPage: page,
  }) => {
    await open(page, "/stats");

    for (const name of ["Level", "Energy", "Activity", "Score", "Patterns", "Overview"]) {
      // oxlint-disable-next-line no-await-in-loop -- Each navigation must use the preceding screen's prefetch.
      await follow({
        link: page
          .getByRole("navigation", { name: "Your stats" })
          .getByRole("link", { exact: true, name }),
        page,
      });
    }
  });

  test("settings tabs paint their complete prefetched content", async ({
    authenticatedPage: page,
  }) => {
    await open(page, "/settings/appearance");

    for (const name of ["Memory", "Subscription", "Help", "Profile", "Preferences"]) {
      // oxlint-disable-next-line no-await-in-loop -- Each navigation must use the preceding screen's prefetch.
      await follow({
        link: page
          .getByRole("navigation", { exact: true, name: "Settings" })
          .getByRole("link", { exact: true, name }),
        page,
      });
    }
  });

  test("Exam opens mock setup instantly", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await open(page, "/exam");
      await follow({ link: await destination({ page, prefix: "/mock/new" }), page });
    });
  });

  test("Plan opens mind maps for a learner with a finished chapter", async ({
    authenticatedPage: page,
    withProgressUser: user,
  }) => {
    const { course, chapters, lessons } = await catalogCourseFixture({ lessonCounts: [1, 1] });

    const goal = await goalFixture({
      primaryCourseId: course.id,
      timezone: "UTC",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id });

    await Promise.all([
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      ...lessons.flatMap((group, position) =>
        group.map((lesson) =>
          planItemFixture({
            chapterId: chapters[position]?.id,
            lessonId: lesson.id,
            planId: plan.id,
            position,
            status: position === 0 ? "done" : "todo",
            titleSnapshot: lesson.title,
          }),
        ),
      ),
    ]);

    await open(page, "/plan");

    await follow({
      link: page
        .getByRole("complementary", { name: "Sidebar" })
        .getByRole("link", { exact: true, name: "Mind maps" }),
      page,
    });
  });

  test("Buddy opens earlier questions", async ({
    authenticatedPage: page,
    withProgressUser: user,
  }) => {
    const thread = await prisma.lessonQuestionThread.create({
      data: { kind: "lesson", userId: user.id },
    });

    await prisma.lessonQuestion.create({
      data: {
        answer: "A saved answer.",
        contextKind: "lesson",
        contextSnapshot: { version: 1 },
        question: "A question from an earlier course?",
        requestFingerprint: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        status: "completed",
        threadId: thread.id,
      },
    });

    await open(page, "/buddy");
    const link = page.getByRole("link", { exact: true, name: "Earlier questions" });
    await follow({ link, page });

    await expect(
      page.getByRole("main").getByText("A question from an earlier course?"),
    ).toBeVisible();
  });

  test("the public catalog opens a course, chapter, and lesson", async ({ page }) => {
    await open(page, "/courses");
    const course = await destination({ page, prefix: "/b/" });
    const coursePath = await course.getAttribute("href");
    expect(coursePath).not.toBeNull();
    await follow({ link: course, page });

    await page
      .getByRole("main")
      .getByText("Mathematics and its Technologies", { exact: true })
      .click();

    const chapter = await destination({ page, prefix: `${coursePath}/ch/` });
    const chapterPath = await chapter.getAttribute("href");
    expect(chapterPath).not.toBeNull();
    await follow({ link: chapter, page });
    await follow({ link: await destination({ page, prefix: `${chapterPath}/l/` }), page });
  });
});
