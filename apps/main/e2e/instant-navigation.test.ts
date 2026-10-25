import { instant } from "@next/playwright";
import { type Locator, type Page, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { createLanguageChallenge } from "./language-challenge-fixtures";
import { asPersona, findPlanChapterId } from "./learn-personas";
import { createMistakeLearner, drillQuestion } from "./mistake-drill-days";
import { runtimePrefetchRead } from "./runtime-prefetch";
import { openAs } from "./study-day";

/** A chapter of Maya's plan with a lesson up next. */
const CHAPTER = "Exponents and scientific notation";

/**
 * The page's own content is painted, with no loading placeholder left in it. Inside `instant()`
 * nothing that isn't prefetched or cached reaches the page, so this is what the tap shows at once.
 */
async function expectPainted(page: Page) {
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(main.locator('[data-slot="skeleton"]')).toHaveCount(0);
}

/** Links prefetch once they're on screen; the page is ready to tap once those have landed. */
async function openSettled(page: Page, path: string) {
  await page.goto(path);
  await expectPainted(page);
  await page.waitForLoadState("networkidle");
}

/**
 * Resolves once the page at `path` has come in with a link's prefetch. Set it up before opening the
 * page with the link: a link below the fold prefetches once it's near the screen, which can be
 * after the page has settled.
 */
async function pagePrefetched(page: Page, path: string) {
  const response = await page.waitForResponse(
    (candidate) =>
      new URL(candidate.url()).pathname === path &&
      (candidate.request().headers()["next-router-segment-prefetch"] ?? "").endsWith("/__PAGE__"),
  );

  await response.finished();
}

/**
 * Like `pagePrefetched`, for a page with the learner's own facts (their goal limit): those come
 * with the link's runtime prefetch, which can land after the page's static part, and the page is
 * ready to tap once the router has read it (`runtimePrefetchRead`).
 */
async function pageAndOwnFactsPrefetched(page: Page, path: string) {
  const ownFacts = runtimePrefetchRead(page, path);
  await pagePrefetched(page, path);
  await ownFacts;
}

/** Taps a link and checks the destination paints from its prefetch, before any server reply. */
async function tapInstantly({
  content,
  link,
  page,
  path,
}: {
  content?: Locator;
  link: string;
  page: Page;
  path: RegExp;
}) {
  await instant(page, async () => {
    await page.locator(`a[href="${link}"]:visible`).first().click();
    await page.waitForURL(path);
    await expectPainted(page);

    if (content) {
      await expect(content).toBeVisible();
    }
  });
}

/**
 * A learner whose plan has one chapter of three lessons: the next one and another one written, and
 * a last one not written yet.
 */
async function createChapterLearner() {
  const user = await createE2EUser(getBaseURL());

  const [goal, chapter, next, written, unwritten] = await Promise.all([
    goalFixture({ timezone: "UTC", title: "Learn percentages", userId: user.id }),
    libraryChapterFixture({ title: "Percentages" }),
    playableLessonFixture({ lesson: { title: "What a percent is" } }),
    playableLessonFixture({ lesson: { title: "Percent of a number" } }),
    libraryLessonFixture({ title: "Percent change" }),
  ]);

  const lessons = [next.lesson, written.lesson, unwritten];

  const [plan] = await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ...lessons.map((lesson, position) =>
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
    ),
  ]);

  await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({ chapterId: chapter.id, lessonId: lesson.id, planId: plan.id, position }),
    ),
  );

  return { chapter, unwritten, user, written: written.lesson };
}

/** Test-owned public content, with a written first screen and one chapter and lesson to open. */
async function createPublicNavigationCourse() {
  const { chapters, course, organization } = await catalogCourseFixture({ lessonCounts: [0] });
  const chapter = chapters[0]!;

  const { lesson } = await playableLessonFixture({
    lesson: { homeChapterId: chapter.id, title: "Public navigation lesson" },
  });

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 });

  const coursePath = `/b/${organization.slug}/c/${course.slug}`;
  const chapterPath = `${coursePath}/ch/${chapter.slug}`;
  const lessonPath = `${chapterPath}/l/${lesson.slug}`;
  return { chapter, chapterPath, course, coursePath, lesson, lessonPath };
}

test.describe("Instant navigation", () => {
  test("Today, Plan, Buddy, Mistakes, Statistics and Settings navigate instantly in both directions", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page }) => {
      // The browser's clock holds still, so each tab shows a copy read moments ago, which doesn't
      // ask whether it changed (useRefreshWhenOld; plan-waits covers that). Inside instant(), Next
      // answers that ask with the page's shell, and the refresh that follows holds the next tap
      // until the scope ends, while the scope waits for that tap.
      await page.clock.setFixedTime(new Date());
      await openSettled(page, "/today");

      for (const link of ["/plan", "/buddy", "/mistakes", "/stats"]) {
        // oxlint-disable-next-line no-await-in-loop -- Each first visit must use the preceding screen's prefetch.
        await tapInstantly({
          content: link === "/buddy" ? page.getByRole("log") : undefined,
          link,
          page,
          path: new RegExp(`${link}$`, "u"),
        });
      }

      const palette = await openPaletteWithKeyboard(page, /Search/iu);
      await palette.getByRole("combobox", { name: /Search/iu }).fill("settings");

      await instant(page, async () => {
        await palette
          .getByRole("group", { name: "Go to" })
          .getByRole("option", { name: /^Settings/u })
          .click();

        await page.waitForURL(/\/settings$/u);
        await expectPainted(page);
        await expect(palette).toBeHidden();
      });

      for (const link of ["/stats", "/mistakes", "/buddy", "/plan", "/today"]) {
        // oxlint-disable-next-line no-await-in-loop -- Revisits must paint from the same frame and prefetched content.
        await tapInstantly({
          content: link === "/buddy" ? page.getByRole("log") : undefined,
          link,
          page,
          path: new RegExp(`${link}$`, "u"),
        });
      }
    });
  });

  test("Today's unfinished quick explanation opens at once, its story painted", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "explain" }, async ({ page, user }) => {
      await openSettled(page, "/today");

      await instant(page, async () => {
        await page.getByRole("link", { name: "Continue explanation" }).click();
        await page.waitForURL(new RegExp(`/explain/${user.goalId}$`, "u"));

        await expect(
          page
            .getByRole("main", { name: "Lesson content" })
            .getByText("The market isn't one price"),
        ).toBeVisible();

        await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
      });
    });
  });

  test("the palette closes for the current Buddy question even with equivalent query encoding", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page }) => {
      await page.goto("/buddy?ask=hello+world");
      await expectPainted(page);
      await expect(page.getByRole("textbox", { name: /Message /u })).toHaveValue("hello world");
      const palette = await openPaletteWithKeyboard(page, /Search/iu);
      await palette.getByRole("combobox", { name: /Search/iu }).fill("hello world");

      await palette
        .getByRole("group", { name: "Ask" })
        .getByRole("option", { name: /^Ask /u })
        .click();

      await expect(palette).toBeHidden();
      await expect(page).toHaveURL(/\/buddy\?ask=hello\+world$/u);
      await expect(page.getByRole("textbox", { name: /Message /u })).toHaveValue("hello world");
      await expectPainted(page);
    });
  });

  test("a public course's back bar opens Explore instantly", async ({ page }) => {
    const { coursePath } = await createPublicNavigationCourse();
    await openSettled(page, coursePath);

    await instant(page, async () => {
      await page.getByRole("link", { exact: true, name: "Back to Explore courses" }).click();
      await page.waitForURL(/\/courses$/u);
      await expectPainted(page);
      await expect(page.getByRole("heading", { level: 1, name: "Explore courses" })).toBeVisible();
    });
  });

  test("a public course's Build my plan opens its start page at once", async ({ page }) => {
    const { course, coursePath } = await createPublicNavigationCourse();
    const prefetched = pageAndOwnFactsPrefetched(page, `/start/course/${course.id}`);
    await openSettled(page, coursePath);
    await prefetched;

    await instant(page, async () => {
      await page
        .getByRole("link", { name: "Build my plan" })
        .filter({ visible: true })
        .first()
        .click();

      await page.waitForURL(new RegExp(`/start/course/${course.id}`, "u"));
      await expectPainted(page);

      await expect(
        page.getByRole("heading", { level: 1, name: "How much do you already know?" }),
      ).toBeVisible();
    });
  });

  test("Start a new goal opens the start page at once, with the goal limit said up front", async ({
    browser,
  }) => {
    const { user } = await createChapterLearner();
    const page = await openAs(browser, user);
    await openSettled(page, "/stats");

    const prefetched = pageAndOwnFactsPrefetched(page, "/start");

    await page
      .getByRole("complementary", { name: "Sidebar" })
      .getByRole("button", { name: /Learn percentages/u })
      .click();

    await prefetched;

    await instant(page, async () => {
      await page.getByRole("menuitem", { name: "Start a new goal" }).click();
      await page.waitForURL(/\/start$/u);
      await expectPainted(page);

      await expect(
        page.getByRole("heading", { level: 1, name: "What do you want to achieve?" }),
      ).toBeVisible();

      await expect(page.getByText(/The free plan follows one goal at a time/u)).toBeVisible();
    });
  });

  test("a public course's edition notice prefetches the edition in the app language", async ({
    page,
  }) => {
    const family = await prisma.courseFamily.create({ data: {} });

    const [original, edition] = await Promise.all([
      catalogCourseFixture({ familyId: family.id, language: "pt" }),
      catalogCourseFixture({ familyId: family.id, language: "en" }),
    ]);

    await openSettled(page, `/b/${original.organization.slug}/c/${original.course.slug}`);
    const editionPath = `/b/${edition.organization.slug}/c/${edition.course.slug}`;

    await instant(page, async () => {
      await page
        .getByRole("link", { name: "This course is also available in your language." })
        .click();

      await page.waitForURL(new URL(editionPath, page.url()).href);
      await expectPainted(page);

      await expect(
        page.getByRole("heading", { level: 1, name: edition.course.title }),
      ).toBeVisible();
    });
  });

  test("a public lesson's aside prefetches its chapter", async ({ page }) => {
    const { chapter, chapterPath, lessonPath } = await createPublicNavigationCourse();
    await openSettled(page, lessonPath);

    await instant(page, async () => {
      await page
        .getByRole("complementary", { name: "Lessons" })
        .getByRole("link", { exact: true, name: chapter.title })
        .click();

      await page.waitForURL(new URL(chapterPath, page.url()).href);
      await expectPainted(page);
      await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();
    });
  });

  test("a public lesson's phone chapter disclosure prefetches its chapter", async ({ page }) => {
    const { chapter, chapterPath, lessonPath } = await createPublicNavigationCourse();
    await page.setViewportSize({ height: 844, width: 390 });
    await openSettled(page, lessonPath);
    await page.getByText(`Chapter 1: ${chapter.title}`, { exact: true }).click();

    await instant(page, async () => {
      await page.getByRole("link", { exact: true, name: "Go to the chapter" }).click();
      await page.waitForURL(new URL(chapterPath, page.url()).href);
      await expectPainted(page);
      await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();
    });
  });

  test("Explore opens a public course instantly in the same frame", async ({ page }) => {
    await openSettled(page, "/courses");
    const card = page.getByRole("list", { name: "Courses" }).getByRole("link").first();
    const href = (await card.getAttribute("href"))!;
    const title = await card.innerText();

    await instant(page, async () => {
      await card.click();
      await page.waitForURL(new URL(href, page.url()).href);
      await expectPainted(page);
      await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeVisible();
      expect(title).toContain(await page.getByRole("heading", { level: 1 }).innerText());
    });
  });

  test("a public course's full outline prefetches its chapter", async ({ page }) => {
    const { chapter, chapterPath, coursePath } = await createPublicNavigationCourse();
    const prefetched = pagePrefetched(page, chapterPath);
    await openSettled(page, coursePath);

    const band = page
      .getByRole("region", { name: "Course outline" })
      .locator("details")
      .filter({ hasText: "Beginner" });

    if ((await band.getAttribute("open")) === null) {
      await band.locator("summary").click();
    }

    const link = page.getByRole("heading", { exact: true, name: chapter.title }).getByRole("link");
    await link.scrollIntoViewIfNeeded();
    await prefetched;

    await instant(page, async () => {
      await link.click();

      await page.waitForURL(new URL(chapterPath, page.url()).href);
      await expectPainted(page);
      await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();
    });
  });

  test("a public course's full outline prefetches its written lesson", async ({ page }) => {
    const { coursePath, lesson, lessonPath } = await createPublicNavigationCourse();
    const prefetched = pagePrefetched(page, lessonPath);
    await openSettled(page, coursePath);

    const band = page
      .getByRole("region", { name: "Course outline" })
      .locator("details")
      .filter({ hasText: "Beginner" });

    if ((await band.getAttribute("open")) === null) {
      await band.locator("summary").click();
    }

    const link = page.getByRole("link", { exact: true, name: lesson.title });
    await link.scrollIntoViewIfNeeded();
    await prefetched;

    await instant(page, async () => {
      await link.click();
      await page.waitForURL(new URL(lessonPath, page.url()).href);
      await expectPainted(page);
      await expect(page.getByRole("heading", { level: 1, name: lesson.title })).toBeVisible();
    });
  });

  test("a public chapter's numbered list prefetches its written lesson", async ({ page }) => {
    const { chapterPath, lesson, lessonPath } = await createPublicNavigationCourse();
    await openSettled(page, chapterPath);

    await instant(page, async () => {
      await page
        .getByRole("region", { name: "Lessons" })
        .getByRole("link", { name: new RegExp(lesson.title, "u") })
        .click();

      await page.waitForURL(new URL(lessonPath, page.url()).href);
      await expectPainted(page);
      await expect(page.getByRole("heading", { level: 1, name: lesson.title })).toBeVisible();
    });
  });

  test("a public lesson's back bar prefetches a chapter that was never visited", async ({
    page,
  }) => {
    const { chapter, chapterPath, lessonPath } = await createPublicNavigationCourse();
    await openSettled(page, lessonPath);

    await instant(page, async () => {
      await page.getByRole("link", { exact: true, name: `Back to ${chapter.title}` }).click();
      await page.waitForURL(new URL(chapterPath, page.url()).href);
      await expectPainted(page);
      await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();
    });
  });

  test("a public chapter's back bar prefetches a course that was never visited", async ({
    page,
  }) => {
    const { chapterPath, course, coursePath } = await createPublicNavigationCourse();
    await openSettled(page, chapterPath);

    await instant(page, async () => {
      await page.getByRole("link", { exact: true, name: `Back to ${course.title}` }).click();
      await page.waitForURL(new URL(coursePath, page.url()).href);
      await expectPainted(page);
      await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
    });
  });

  test("a public lesson's course breadcrumb prefetches a course that was never visited", async ({
    page,
  }) => {
    const { course, coursePath, lessonPath } = await createPublicNavigationCourse();
    await openSettled(page, lessonPath);

    await instant(page, async () => {
      await page.getByRole("main").getByRole("link", { exact: true, name: course.title }).click();
      await page.waitForURL(new URL(coursePath, page.url()).href);
      await expectPainted(page);
      await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
    });
  });

  test("the notebook prefetches the next page of mistakes", async ({ browser }) => {
    const { drills, user } = await createMistakeLearner({ causes: ["misread"] });
    const [drill] = drills;

    await Promise.all(
      Array.from({ length: 50 }, (_, index) =>
        mistakeFixture({
          skillId: drill!.skill.id,
          snapshot: { answer: "Wrong", question: `Recent mistake ${index}` },
          userId: user.id,
        }),
      ),
    );

    const page = await openAs(browser, user);
    await openSettled(page, "/mistakes");

    await instant(page, async () => {
      await page.getByRole("link", { name: "Show more" }).click();
      await page.waitForURL(/\/mistakes\?offset=50$/u);
      await expectPainted(page);

      await expect(
        page.getByText(drillQuestion("misread", "original"), { exact: true }),
      ).toBeVisible();
    });

    await page.context().close();
  });

  test("the notebook's Fixed tab prefetches its query-specific entries", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await openSettled(page, "/mistakes");

      await instant(page, async () => {
        await page
          .getByRole("navigation", { name: "Mistakes" })
          .getByRole("link", { name: /^Fixed/u })
          .click();

        await page.waitForURL(/\/mistakes\?status=fixed$/u);
        await expectPainted(page);
        await expect(page.getByRole("region", { name: "What you fixed" })).toBeVisible();
      });
    });
  });

  test("the Plan opens an unfinished goal's next step without a page skeleton", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const goal = await goalFixture({ timezone: "UTC", title: "Learn navigation", userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);
    await openSettled(page, "/courses");

    await instant(page, async () => {
      await page
        .getByRole("navigation", { name: "Learning tabs" })
        .getByRole("link", { name: "Plan" })
        .click();

      await page.waitForURL(/\/plan$/u);
      await expectPainted(page);

      await expect(
        page.getByRole("heading", { name: "Your plan comes after a few questions" }),
      ).toBeVisible();
    });

    await page.context().close();
  });

  test("the palette opens Preferences instantly from Enter without visiting Settings first", async ({
    page,
  }) => {
    await openSettled(page, "/courses");
    const palette = await openPaletteWithKeyboard(page, /Search/iu);
    const input = palette.getByRole("combobox", { name: /Search/iu });
    await input.fill("language");
    const option = palette.getByRole("option", { name: /^Language/u });
    await expect(option).toBeVisible();

    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      (await option.getAttribute("id"))!,
    );

    await instant(page, async () => {
      await page.keyboard.press("Enter");
      await page.waitForURL(/\/settings\/appearance$/u);
      await expectPainted(page);
      await expect(page.getByRole("combobox", { name: "App language" })).toBeVisible();
      await expect(palette).toBeHidden();
    });
  });

  test("the palette prefetches a searched plan chapter before opening it", async ({ browser }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const chapterId = await findPlanChapterId(user.goalId, CHAPTER);
      await openSettled(page, "/today");
      const palette = await openPaletteWithKeyboard(page, /Search/iu);
      await palette.getByRole("combobox", { name: /Search/iu }).fill("Exponents");

      const chapter = palette
        .getByRole("group", { name: "Your plan" })
        .getByRole("option", { name: new RegExp(`^${CHAPTER}`, "u") });

      await expect(chapter).toBeVisible();

      await instant(page, async () => {
        await chapter.click();
        await page.waitForURL(new RegExp(`/content/chapters/${chapterId}$`, "u"));
        await expectPainted(page);
        await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();
        await expect(palette).toBeHidden();
      });
    });
  });

  test("the phone's bottom tab opens the Plan instantly", async ({ browser }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page }) => {
      await page.setViewportSize({ height: 844, width: 390 });
      await openSettled(page, "/today");

      await instant(page, async () => {
        await page
          .getByRole("navigation", { name: "Learning tabs" })
          .getByRole("link", { name: "Plan" })
          .click();

        await page.waitForURL(/\/plan$/u);
        await expectPainted(page);
      });
    });
  });

  test("catalog category links prefetch their URL-specific list", async ({ page }) => {
    await openSettled(page, "/courses");

    const link = page
      .getByRole("navigation", { name: "Course categories" })
      .locator('a[href^="/courses/"]:visible')
      .first();

    const href = await link.getAttribute("href");
    expect(href).not.toBeNull();
    const label = await link.locator("span").first().innerText();

    await link.scrollIntoViewIfNeeded();
    await page.waitForLoadState("networkidle");

    await instant(page, async () => {
      await link.click();

      await page.waitForURL(new URL(href!, page.url()).href);
      await expectPainted(page);

      await expect(
        page.getByRole("heading", { level: 1, name: `Courses in ${label}` }),
      ).toBeVisible();

      await expect(
        page
          .getByRole("main")
          .getByRole("list", { name: "Courses" })
          .or(page.getByRole("main").getByText("No courses available yet.", { exact: true })),
      ).toBeVisible();
    });
  });

  test("Today, the Plan and the buddy open with their content at once, both ways", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page }) => {
      await openSettled(page, "/today");

      await tapInstantly({
        content: page.getByRole("log"),
        link: "/buddy",
        page,
        path: /\/buddy$/u,
      });

      await expect(page.getByRole("log")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await tapInstantly({ link: "/today", page, path: /\/today$/u });
      await page.waitForLoadState("networkidle");

      await tapInstantly({ link: "/plan", page, path: /\/plan$/u });
      await page.waitForLoadState("networkidle");

      // The buddy's conversation comes with the tab: no wait for its messages.
      await tapInstantly({ link: "/buddy", page, path: /\/buddy$/u });
      await expect(page.getByRole("log")).toBeVisible();
      await page.waitForLoadState("networkidle");

      await tapInstantly({ link: "/today", page, path: /\/today$/u });
    });
  });

  test("the app keeps one frame: statistics, the catalog and the notebook open in it at once", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page }) => {
      // Settings' own first page (whose account it is) comes with its link's prefetch, which the
      // account menu's links send once it opens: watched from the start, so it's never missed.
      const settingsPrefetched = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/settings" &&
          response.request().headers()["next-router-prefetch"] === "2",
        { timeout: 0 },
      );

      await openSettled(page, "/today");

      // A frame drawn again would be a new element, without this mark.
      const sidebar = page.locator('[data-slot="learn-sidebar"]');

      await sidebar.evaluate((element) => {
        element.dataset.kept = "";
      });

      await tapInstantly({
        content: page.getByRole("figure", { name: /past 12 months/iu }),
        link: "/stats",
        page,
        path: /\/stats$/u,
      });

      await page.waitForLoadState("networkidle");

      await tapInstantly({
        content: page.getByRole("heading", { name: "Belt progression" }),
        link: "/level",
        page,
        path: /\/level$/u,
      });

      await page.waitForLoadState("networkidle");

      // The catalog is in the goal menu, whose links load ahead once it opens.
      await sidebar.getByRole("button", { name: /Current goal/u }).click();
      await page.waitForLoadState("networkidle");

      await tapInstantly({ link: "/courses", page, path: /\/courses$/u });
      await page.waitForLoadState("networkidle");

      // Today and its full-height aside stay mounted, hidden, for going back: the catalog still
      // gets the frame's own padding, as on a page load.
      await expect(page.getByRole("main")).toHaveCSS("padding-top", "32px");
      await expect(page.getByRole("main")).toHaveCSS("padding-right", "40px");

      await tapInstantly({ link: "/mistakes", page, path: /\/mistakes$/u });
      await page.waitForLoadState("networkidle");

      await tapInstantly({ link: "/today", page, path: /\/today$/u });

      // Settings open from the account menu, in the same frame: the static shell has the page's
      // frame, and its first page came with the link's prefetch.
      await page.getByRole("button", { name: /user menu/iu }).click();
      await settingsPrefetched;

      await instant(page, async () => {
        await page.getByRole("menuitem", { name: "Settings" }).click();
        await page.waitForURL(/\/settings$/u);
        await expectPainted(page);
        await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
      });

      await page.waitForLoadState("networkidle");

      await tapInstantly({
        content: page.getByRole("combobox", { name: "App language" }),
        link: "/settings/appearance",
        page,
        path: /\/settings\/appearance$/u,
      });

      await expect(page.getByRole("combobox", { name: "App language" })).toBeVisible();

      await expect(sidebar).toHaveAttribute("data-kept", "");
    });
  });

  test("a chapter's next lesson opens at once", async ({ browser }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const chapterId = await findPlanChapterId(user.goalId, CHAPTER);
      const writingRequests: string[] = [];

      await page.route("**/v1/library/lessons/*/generations", (route) => {
        writingRequests.push(route.request().url());
        return route.abort();
      });

      await openSettled(page, `/content/chapters/${chapterId}`);

      const next = page
        .getByRole("region", { name: "Lessons" })
        .getByRole("link", { name: /^Up next /u });

      const href = await next.getAttribute("href");

      await instant(page, async () => {
        await next.click();
        await page.waitForURL(new RegExp(`${href}$`, "u"));
        // The player itself, at its first screen: its progress bar, and no placeholder.
        await expect(page.getByRole("progressbar").first()).toBeVisible();
        await expect(page.getByRole("main").locator('[data-slot="skeleton"]')).toHaveCount(0);
      });

      expect(writingRequests).toStrictEqual([]);

      await page.goBack();
      await expectPainted(page);

      // The chapter's main action carries the same known written status as its lesson row.
      await instant(page, async () => {
        await page.getByRole("link", { exact: true, name: "Continue" }).click();
        await page.waitForURL(new RegExp(`${href}$`, "u"));
        await expect(page.getByRole("progressbar").first()).toBeVisible();
        await expect(page.getByRole("main").locator('[data-slot="skeleton"]')).toHaveCount(0);
      });

      expect(writingRequests).toStrictEqual([]);
    });
  });

  test("a chapter's written lessons open at once; one not written yet loads on the tap", async ({
    browser,
  }) => {
    const { chapter, unwritten, user, written } = await createChapterLearner();
    const page = await openAs(browser, user);
    const writingRequests: string[] = [];
    const writing = Promise.withResolvers<Route>();

    await page.route("**/v1/library/lessons/*/generations", (route) => {
      writingRequests.push(route.request().url());

      if (route.request().url().endsWith(`/${unwritten.id}/generations`)) {
        writing.resolve(route);
        return;
      }

      return route.abort();
    });

    await openSettled(page, `/content/chapters/${chapter.id}`);

    const lessons = page.getByRole("region", { name: "Lessons" });

    // Reading the plan's written lessons counts toward no limit, so the list loads them ahead.
    await instant(page, async () => {
      await lessons.getByRole("link", { name: /Percent of a number/u }).click();
      await page.waitForURL(new RegExp(`/learn/${written.id}$`, "u"));
      await expect(page.getByRole("progressbar").first()).toBeVisible();
      await expect(page.getByRole("main").locator('[data-slot="skeleton"]')).toHaveCount(0);
    });

    expect(writingRequests).toStrictEqual([]);

    await page.goBack();
    await expectPainted(page);

    // The explicit tap requests writing first. Once answered, navigation paints the prefetched
    // player frame immediately; a failed API request still opens its retry instead of stranding it.
    await lessons.getByRole("link", { name: /Percent change/u }).click();
    const request = await writing.promise;
    expect(request.request().method()).toBe("POST");

    await instant(page, async () => {
      await request.fulfill({ json: { error: "Writing is unavailable" }, status: 503 });
      await page.waitForURL(new RegExp(`/learn/${unwritten.id}\\?writing=failed$`, "u"));
      await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible();
    });

    expect(writingRequests).toHaveLength(1);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    await page.context().close();
  });

  test("Today's Start opens its language call's intro at once", async ({ browser }) => {
    const { block, user } = await createLanguageChallenge({ final: false, plus: true });
    const href = `/checkpoint/${block.id}?session=${block.sessionId}`;
    const page = await openAs(browser, user);
    const start = page.getByRole("link", { name: /^(?:Start|Continue) session/u });

    // The call's page comes in with Start's own prefetch, before the tap.
    const prefetched = page.waitForResponse((response) => {
      const headers = response.request().headers();

      return (
        new URL(response.url()).pathname === `/checkpoint/${block.id}` &&
        Boolean(headers["next-router-prefetch"] ?? headers["next-router-segment-prefetch"])
      );
    });

    await openSettled(page, "/today");
    await expect(start).toHaveAttribute("href", href);
    const prefetch = await prefetched;
    await prefetch.finished();

    await instant(page, async () => {
      await start.click();

      await page.waitForURL(
        new RegExp(`/checkpoint/${block.id}\\?session=${block.sessionId}$`, "u"),
      );

      await expectPainted(page);

      await expect(
        page.getByRole("heading", { level: 1, name: RENTING_SCENARIO.title }),
      ).toBeVisible();

      await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
    });

    // Opening the intro starts nothing: the call is made by its own Start.
    await expect(prisma.languageConversation.count({ where: { userId: user.id } })).resolves.toBe(
      0,
    );

    await page.context().close();
  });
});
