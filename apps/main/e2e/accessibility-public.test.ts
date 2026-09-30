import { prisma } from "@zoonk/db";
import { expectAccessibleRoutes } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { expect, test } from "./fixtures";
import { MODES, setDeviceMode } from "./learn-personas";

/**
 * Accessibility of what visitors see: the home page, the catalog, public course, chapter and lesson
 * pages, a shared plan, the legal pages, a missing page and the start of onboarding, at phone and
 * desktop widths, light and dark: no serious or critical axe violation. Sign-in lives on the auth
 * host, whose pages the API app scans.
 */

const SCAN_TIMEOUT_MS = 300_000;

/** The seeded overview course's first written lesson, read-only. */
async function findPublicLessonPath() {
  const lesson = await prisma.lesson.findFirstOrThrow({
    include: { homeChapter: { include: { homeCourse: true } } },
    orderBy: { slug: "asc" },
    where: {
      contentStatus: "completed",
      homeChapter: { homeCourse: { slug: "how-the-stock-market-works" } },
    },
  });

  const coursePath = `/b/${AI_ORG_SLUG}/c/${lesson.homeChapter?.homeCourse?.slug}`;
  const chapterPath = `${coursePath}/ch/${lesson.homeChapter?.slug}`;

  return { chapterPath, coursePath, lessonPath: `${chapterPath}/l/${lesson.slug}` };
}

test.describe.configure({ timeout: SCAN_TIMEOUT_MS });

test.describe("Public pages are accessible", () => {
  test("home, pricing, catalog, public Library pages and legal pages", async ({ page }) => {
    const { chapterPath, coursePath, lessonPath } = await findPublicLessonPath();

    await expectAccessibleRoutes(page, [
      { path: "/" },
      { path: "/pricing" },
      { path: "/courses" },
      { path: "/courses/science" },
      { path: coursePath },
      {
        label: "the course page with its full outline open",
        path: coursePath,
        ready: (current) => current.getByText("See all chapters and lessons").click(),
      },
      { path: chapterPath },
      { path: lessonPath },
      {
        label: "the lesson page with what you'll learn and its chapter open",
        path: lessonPath,
        ready: async (current) => {
          await current.getByText("What you'll learn").click();
          await current.getByText(/^Chapter \d+:/u).click();
        },
      },
      { path: "/privacy" },
      { path: "/terms" },
    ]);
  });

  test("a shared plan and a missing page", async ({ page }) => {
    const owner = await createE2EPersona(getBaseURL(), { persona: "exam" });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: owner.goalId } });

    await expectAccessibleRoutes(page, [
      { path: `/plan-link/${plan.id}` },
      {
        label: "a missing page",
        path: "/b/ai/c/no-such-course",
        ready: (current) => expect(current.getByRole("heading", { level: 1 })).toBeVisible(),
      },
    ]);
  });

  for (const mode of MODES) {
    test(`the start of onboarding in ${mode}`, async ({ page }) => {
      await setDeviceMode(page.context(), mode);
      await expectAccessibleRoutes(page, [{ path: "/start" }]);
    });
  }
});
