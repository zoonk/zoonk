import { randomUUID } from "node:crypto";
import { type Locator } from "@playwright/test";
import { getExamBlueprintCacheTag } from "@zoonk/core/cache-tags";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Page, expect, test } from "./fixtures";

/** Matches Main's Playwright-only cache hook secret (`playwright.config.ts`). */
const CACHE_SECRET_HEADERS = { "x-zoonk-cache-secret": "e2e-cache-tags-secret" };

/** The seeded course whose outline core can plan at the time a day its example shows. */
const PLANNED_COURSE_PATH = `/b/${AI_ORG_SLUG}/c/quantum-physics-from-scratch`;

/** The example plan's headline number: its weeks to the course's end. */
async function readPlanWeeks(plan: Locator): Promise<number> {
  const text = await plan
    .getByText(/~\d+\s*weeks?/u)
    .first()
    .innerText();

  return Number(/~(?<weeks>\d+)\s*weeks?/u.exec(text)?.groups?.weeks);
}

/** The latest week any chapter of the outline shows ("Week 3", "Weeks 18–20"), at the example's time a day. */
async function readLastOutlineWeek(page: Page): Promise<number> {
  const marks = await page
    .getByRole("region", { name: "Course outline" })
    .getByText(/^Weeks? \d+(?:–\d+)?$/u)
    .filter({ visible: true })
    .allInnerTexts();

  return Math.max(...marks.map((mark) => Number(/(?<last>\d+)$/u.exec(mark)?.groups?.last)));
}

async function publishedCourse(attrs: {
  language: string;
  targetLanguage?: string;
  title: string;
}) {
  const org = await getAiOrganization();

  const course = await courseFixture({
    ...attrs,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-course-detail-${randomUUID().slice(0, 8)}`,
  });

  return { course, path: `/b/${org.slug}/c/${course.slug}` };
}

const MS_PER_DAY = 86_400_000;

/** A day some days from now, as a notice writes it ("YYYY-MM-DD", UTC). */
function dayIn(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** A notice edition with its exam days, in UTC. */
function examEdition(dates: string[]) {
  return {
    citations: [],
    dates: dates.map((date) => ({
      citation: { passage: "Exam day", sourceId: "notice" },
      date,
      kind: "exam",
      label: "Exam",
    })),
    noticeUrl: null,
    questionCount: null,
    sourceHash: null,
    timeZone: "UTC",
    year: Number(dates[0]?.slice(0, 4)),
  };
}

/**
 * A published exam course whose stored exam graph starts on it, with its notice's days. `toWrite`
 * adds a skill of that many lessons nobody wrote yet, more than the example's time holds by then.
 */
async function publishedExamCourse(dates: string[], { toWrite = 0 }: { toWrite?: number } = {}) {
  const { course, path } = await publishedCourse({
    language: "en",
    title: `E2E Exam Course ${randomUUID().slice(0, 8)}`,
  });

  await prisma.course.update({ data: { format: "exam" }, where: { id: course.id } });

  const [blueprint, [band], unwritten] = await Promise.all([
    examBlueprintFixture({ edition: examEdition(dates) }),
    courseBandsFixture({ courseId: course.id, levels: ["beginner"] }),
    toWrite > 0 ? skillFixture() : null,
  ]);

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: new Date(),
      graph: {
        phases: [{ milestone: null, name: "Exam" }],
        skills: [
          {
            area: null,
            courseIds: [course.id],
            lessons: 1,
            name: band?.skill.name ?? "",
            phase: 0,
            skillId: band?.skill.id ?? "",
            weight: null,
          },
          ...(unwritten
            ? [
                {
                  area: null,
                  courseIds: [course.id],
                  lessons: toWrite,
                  name: unwritten.name,
                  phase: 0,
                  skillId: unwritten.id,
                  weight: null,
                },
              ]
            : []),
        ],
      },
      model: "fixture",
      primaryCourseId: course.id,
      promptVersion: "fixture",
      runId: "fixture",
    },
  });

  return { blueprint, course, path };
}

/** A notice day as the page's eyebrow writes it ("Nov 8"). */
function eyebrowDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

test.describe("Course Detail Page", () => {
  test("a course that doesn't exist answers 404 inside the catalog, with the way to the courses", async ({
    page,
  }) => {
    const response = await page.goto(`/b/${AI_ORG_SLUG}/c/nonexistent-course`);
    const main = page.getByRole("main");

    expect(response?.status()).toBe(404);
    await expect(main.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Back to Explore courses" })).toBeVisible();
    await expectAccessibleScreen(page, "a missing course");

    await main.getByRole("link", { exact: true, name: "Explore courses" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Explore courses" })).toBeVisible();
  });

  test("a language course whose outline isn't written yet leads with its flag and stays on its page", async ({
    page,
  }) => {
    const title = `E2E Language Course ${randomUUID().slice(0, 8)}`;
    const { course, path } = await publishedCourse({ language: "en", targetLanguage: "pt", title });

    await page.goto(path);

    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("img", { name: "Brazilian Portuguese" })).toBeVisible();

    await expect(
      page.getByText(
        "Build your plan and Zoonk writes this course's chapters and lessons for you, starting at your level.",
      ),
    ).toBeVisible();

    // Its start asks the visitor's level for the whole course, whose outline comes once it starts.
    await expect(page.getByRole("link", { name: "Build my plan" }).first()).toHaveAttribute(
      "href",
      `/start/course/${course.id}`,
    );

    // On a phone the invitation reads whole, with nothing scrolling sideways.
    await page.setViewportSize({ height: 844, width: 390 });

    await expect(
      page.getByRole("region", { name: "Course outline" }).getByText(/^Build your plan and Zoonk/u),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });

  test("an exam course's page reads a notice another app revised once its tag reaches this app", async ({
    page,
    request,
  }) => {
    const first = dayIn(40);
    const revised = dayIn(54);
    const { blueprint, path } = await publishedExamCourse([first]);

    await page.goto(path);
    await expect(page.getByText(new RegExp(`^Exam on ${eyebrowDay(first)} · `, "u"))).toBeVisible();

    // The API's notice research revises the edition, then its tag expiry reaches this app the way
    // `revalidateCacheTags` forwards it: until then the page keeps the sitting it showed.
    await prisma.examBlueprint.update({
      data: { edition: examEdition([revised]) },
      where: { id: blueprint.id },
    });

    await page.reload();
    await expect(page.getByText(new RegExp(`^Exam on ${eyebrowDay(first)} · `, "u"))).toBeVisible();

    const expired = await request.post("/api/cache/tags", {
      data: { tags: [getExamBlueprintCacheTag(blueprint.id)] },
      headers: CACHE_SECRET_HEADERS,
    });

    expect(expired.status()).toBe(200);

    await page.reload();

    await expect(
      page.getByText(new RegExp(`^Exam on ${eyebrowDay(revised)} · `, "u")),
    ).toBeVisible();
  });

  test("an exam course's example says whether all of it fits by the exam, never a share of it", async ({
    page,
  }) => {
    const [fits, short] = await Promise.all([
      publishedExamCourse([dayIn(40)]),
      publishedExamCourse([dayIn(40)], { toWrite: 300 }),
    ]);

    const plan = page.getByRole("main").locator("[data-slot='course-plan']");

    await page.goto(fits.path);
    await expect(plan.getByText("That's every topic in the course, in depth.")).toBeVisible();

    // What doesn't fit leaves the share to the start, where the visitor's level and time decide it.
    await page.goto(short.path);

    await expect(
      plan.getByText(
        "Not all of it fits by then. Before you start, you see how much fits at your level and your time.",
      ),
    ).toBeVisible();

    await expect(plan.getByText(/%/u)).toHaveCount(0);
  });

  test("a long level shows its first chapters and the rest on a tap, all of them in the page's HTML", async ({
    page,
    request,
  }) => {
    const { course, organization } = await catalogCourseFixture({
      lessonCounts: Array.from({ length: 9 }, () => 1),
    });

    const path = `/b/${organization.slug}/c/${course.slug}`;
    const response = await request.get(path);
    const html = await response.text();

    expect(html).toContain("Chapter 9");
    expect(html).toContain("Lesson 9.1");

    await page.goto(path);

    const outline = page.getByRole("region", { name: "Course outline" });
    const seventh = outline.getByRole("link", { exact: true, name: "Chapter 7" });

    await expect(outline.getByRole("link", { exact: true, name: "Chapter 6" })).toBeVisible();
    await expect(seventh).toBeHidden();

    await outline.getByText("Show 3 more chapters", { exact: true }).click();
    await expect(seventh).toBeVisible();
    await expect(outline.getByRole("link", { exact: true, name: "Lesson 9.1" })).toBeVisible();
  });

  test("titles a course with a regional language tag in its own language", async ({ page }) => {
    const title = `E2E Regional Course ${randomUUID().slice(0, 8)}`;
    const { path } = await publishedCourse({ language: "pt-BR", title });

    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveTitle(`Aprenda ${title} | Zoonk`);
  });

  test("the example plan shows one time a day, and the outline's weeks and Build my plan follow it", async ({
    page,
  }) => {
    await page.goto(PLANNED_COURSE_PATH);

    const plan = page.getByRole("main").locator("[data-slot='course-plan']");
    const outline = page.getByRole("region", { name: "Course outline" });

    // One example, at 15 minutes a day: weeks to the course's end, and the outline marked at it.
    await expect(plan.getByRole("heading", { name: "Example plan" })).toBeVisible();

    await expect(
      plan.getByText(/at 15 minutes a day, Monday to Friday, from scratch/u),
    ).toBeVisible();

    await expect(plan.getByRole("radio")).toHaveCount(0);

    // When that ends for someone starting today, the estimate the Plan's road ends with.
    await expect(plan.getByText(/^Starting today, you'd finish around .+\.$/u)).toBeVisible();
    await expect(outline.getByText("Your plan at 15 minutes a day, from scratch")).toBeVisible();

    const weeks = await readPlanWeeks(plan);
    expect(weeks).toBeGreaterThan(0);
    // No chapter starts after the course ends.
    expect(await readLastOutlineWeek(page)).toBeLessThanOrEqual(weeks);

    // "Build my plan" starts the plan at the example's time a day.
    const start = page.getByRole("main").getByRole("link", { name: "Build my plan" }).first();
    await expect(start).toHaveAttribute("href", /\?minutes=15$/u);
  });
});
