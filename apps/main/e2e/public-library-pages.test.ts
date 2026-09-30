import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-lessons";
import { SITE_URL } from "@zoonk/utils/url";
import { type Page, expect, test } from "./fixtures";
import { MODES, expectMode, setDeviceMode } from "./learn-personas";

const REVEAL = "It spreads out into a cloud of places where it could be.";
const HIDDEN_SCREEN = "This second screen only loads in the player.";
const WRONG_REASON = "A planet would give off light and spiral in.";

/**
 * A published course with a Library outline like the outline writer leaves
 * it: two chapters, the second with one written lesson (a guess first, then
 * more screens) and one lesson that isn't written yet.
 */
async function createLibraryCourse() {
  const id = randomUUID().slice(0, 8);
  const org = await getAiOrganization();

  const course = await courseFixture({
    description: `How the smallest things behave ${id}`,
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-quantum-${id}`,
    title: `E2E Quantum Physics ${id}`,
  });

  const [firstChapter, chapter] = await Promise.all([
    libraryChapterFixture({ homeCourseId: course.id, slug: `waves-${id}`, title: `Waves ${id}` }),
    libraryChapterFixture({
      homeCourseId: course.id,
      objectives: [`Explain why atoms are stable ${id}`],
      slug: `inside-the-atom-${id}`,
      title: `Inside the atom ${id}`,
    }),
  ]);

  const [written, unwritten] = await Promise.all([
    libraryLessonFixture({
      contentStatus: "completed",
      description: `If it did, atoms wouldn't exist ${id}`,
      estimatedMinutes: 5,
      homeChapterId: chapter.id,
      slug: `why-electrons-stay-${id}`,
      summary: { ideas: [{ text: `The planet picture can't work ${id}` }] },
      title: `Why doesn't the electron fall into the nucleus ${id}`,
    }),
    libraryLessonFixture({
      homeChapterId: chapter.id,
      slug: `electron-shells-${id}`,
      title: `How do electrons fill the shells ${id}`,
    }),
  ]);

  await Promise.all([
    courseChapterFixture({ chapterId: firstChapter.id, courseId: course.id, position: 0 }),
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 1 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: written.id, position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: unwritten.id, position: 1 }),
    libraryStepFixture({
      content: {
        options: [
          { id: "planet", isCorrect: false, text: "Yes, like a tiny planet" },
          { id: "cloud", isCorrect: true, text: "No, it's more like a cloud" },
        ],
        question: "Does the electron circle the nucleus like Earth circles the Sun?",
        reveal: REVEAL,
        variant: "guess",
      },
      kind: "hook",
      lessonId: written.id,
      position: 0,
    }),
    libraryStepFixture({
      content: { text: HIDDEN_SCREEN },
      kind: "explanation",
      lessonId: written.id,
      position: 1,
    }),
    libraryStepFixture({
      content: {
        options: [
          { id: "a", isCorrect: true, reason: "Right.", text: "A cloud" },
          { id: "b", isCorrect: false, reason: WRONG_REASON, text: "A planet" },
        ],
        question: "Which picture fits?",
      },
      kind: "check",
      lessonId: written.id,
      position: 2,
    }),
  ]);

  const coursePath = `/b/${org.slug}/c/${course.slug}`;
  const chapterPath = `${coursePath}/ch/${chapter.slug}`;

  return {
    chapter,
    chapterPath,
    course,
    coursePath,
    id,
    lessonPath: `${chapterPath}/l/${written.slug}`,
    unwritten,
    unwrittenPath: `${chapterPath}/l/${unwritten.slug}`,
    written,
  };
}

/** Reads every JSON-LD item on the page, failing on invalid JSON. */
async function readStructuredData(page: Page): Promise<Record<string, unknown>[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return scripts.map((text) => JSON.parse(text) as Record<string, unknown>);
}

/**
 * Stands in for the API while a visitor's lesson is written: asking for it answers with a run, and
 * following that run writes the lesson (straight to the database, as the API's workflow does)
 * and then says it's ready. Returns every request that asked for a lesson.
 */
async function writeLessonWhenFollowed({ lessonId, page }: { lessonId: string; page: Page }) {
  const runId = `e2e-public-start-${randomUUID()}`;
  const asked: string[] = [];

  page.on("request", (sent) => {
    if (sent.method() === "POST" && sent.url().includes("/generations")) {
      asked.push(sent.url());
    }
  });

  await page.route("**/v1/library/lessons/*/generations", (route) =>
    route.fulfill({ json: { generationId: runId, status: "generating" }, status: 202 }),
  );

  await page.route(`**/v1/generations/${runId}`, (route) =>
    route.fulfill({ json: { id: runId, status: "running" }, status: 200 }),
  );

  await page.route(`**/v1/generations/${runId}/events**`, async (route) => {
    await Promise.all([
      libraryStepFixture({
        content: playableStepContent.explanation,
        kind: "explanation",
        lessonId,
        position: 0,
      }),
      libraryStepFixture({
        content: playableStepContent.check,
        kind: "check",
        lessonId,
        position: 1,
      }),
    ]);

    await prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: lessonId } });

    const events = [
      { entityId: lessonId, status: "started", step: "writeLesson" },
      { entityId: lessonId, status: "completed", step: "writeLesson" },
      { entityId: lessonId, status: "completed", step: "lessonReady" },
    ];

    await route.fulfill({
      body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      contentType: "text/event-stream",
      status: 200,
    });
  });

  return { asked, runId };
}

async function readHead(page: Page) {
  return page.evaluate(() => ({
    canonical: document.querySelector<HTMLLinkElement>("link[rel='canonical']")?.href,
    robots: document.querySelector<HTMLMetaElement>("meta[name='robots']")?.content,
  }));
}

test.describe("public Library lesson page", () => {
  test("puts only the public part of the lesson in the HTML", async ({ request }) => {
    const { id, lessonPath } = await createLibraryCourse();
    const response = await request.get(lessonPath);
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).toContain(`Why doesn't the electron fall into the nucleus ${id}`);
    expect(html).toContain("Does the electron circle the nucleus like Earth circles the Sun?");
    expect(html).toContain("No, it&#x27;s more like a cloud");
    expect(html).toContain(`The planet picture can&#x27;t work ${id}`);
    expect(html).toContain(`How do electrons fill the shells ${id}`);

    expect(html).not.toContain(REVEAL);
    expect(html).not.toContain(HIDDEN_SCREEN);
    expect(html).not.toContain(WRONG_REASON);
    expect(html).not.toContain("isCorrect");
  });

  test("describes the lesson with structured data and indexes it", async ({ page }) => {
    const { course, id, lessonPath } = await createLibraryCourse();
    await page.goto(lessonPath);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Why doesn't the electron fall into the nucleus ${id}`,
      }),
    ).toBeVisible();

    const items = await readStructuredData(page);

    expect(items).toContainEqual(
      expect.objectContaining({
        "@type": "LearningResource",
        isPartOf: expect.objectContaining({ name: course.title }),
        name: `Why doesn't the electron fall into the nucleus ${id}`,
        timeRequired: "PT5M",
      }),
    );

    expect(items).toContainEqual(expect.objectContaining({ "@type": "BreadcrumbList" }));

    await expect
      .poll(() => readHead(page))
      .toStrictEqual({ canonical: `${SITE_URL}${lessonPath}`, robots: "index, follow" });
  });

  test("any answer to the first question opens the player with that answer", async ({ page }) => {
    const { lessonPath, written } = await createLibraryCourse();
    await page.goto(lessonPath);

    const question = page.getByRole("form", {
      name: "Does the electron circle the nucleus like Earth circles the Sun?",
    });

    const playerRequest = page.waitForRequest((request) =>
      request.url().includes(`/learn/${written.id}?answer=cloud`),
    );

    await question.getByRole("button", { name: "No, it's more like a cloud" }).click();
    await playerRequest;
  });

  test("keeps what you'll learn and the rest of the chapter one tap away", async ({ page }) => {
    const { id, lessonPath } = await createLibraryCourse();
    await page.goto(lessonPath);

    const idea = page.getByText(`The planet picture can't work ${id}`);
    const otherLesson = page.getByRole("link", { name: `How do electrons fill the shells ${id}` });

    await expect(idea).toBeHidden();
    await expect(otherLesson).toBeHidden();

    await page.getByText("What you'll learn").click();
    await expect(idea).toBeVisible();

    await page.getByText(`Chapter 2: Inside the atom ${id}`).click();
    await expect(otherLesson).toBeVisible();
  });

  test("offers to start a lesson that isn't written yet and still indexes it", async ({ page }) => {
    const { id, unwrittenPath } = await createLibraryCourse();
    await page.goto(unwrittenPath);

    await expect(
      page.getByRole("heading", { level: 1, name: `How do electrons fill the shells ${id}` }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Start this lesson" })).toBeVisible();
    await expect.poll(() => readHead(page)).toMatchObject({ robots: "index, follow" });
  });

  for (const mode of MODES) {
    test(`starts a lesson that isn't written yet in one tap and plays it once written (${mode})`, async ({
      page,
    }) => {
      const { unwritten, unwrittenPath } = await createLibraryCourse();
      await setDeviceMode(page.context(), mode);
      const { asked, runId } = await writeLessonWhenFollowed({ lessonId: unwritten.id, page });

      await page.goto(unwrittenPath);
      const start = page.getByRole("button", { name: "Start this lesson" });
      await expect(start).toBeVisible();

      // Loading the page alone makes no guest and asks for nothing, so a crawler starts no AI work.
      const before = await page.request.get("/api/auth/get-session");
      expect(await before.json()).toBeNull();
      expect(asked).toStrictEqual([]);

      const followed = page.waitForRequest(`**/v1/generations/${runId}/events**`);
      await start.click();

      // One tap: the visitor became a guest, the player asked for the lesson once and followed
      // the run writing it, with no second "Start".
      await expect(page).toHaveURL(new RegExp(`/learn/${unwritten.id}$`, "u"));
      await followed;

      await expect(page.getByText(playableStepContent.explanation.title)).toBeVisible();
      await expectMode(page, mode);
      expect(asked).toHaveLength(1);

      const session = await page.request.get("/api/auth/get-session");
      expect(await session.json()).toMatchObject({ user: { isAnonymous: true } });

      // The lesson plays: its next screen is a question.
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText(playableStepContent.check.question)).toBeVisible();
    });
  }

  test("points a reused lesson's canonical URL to its home chapter", async ({ page }) => {
    const [home, other] = await Promise.all([createLibraryCourse(), createLibraryCourse()]);

    await chapterLessonFixture({
      chapterId: other.chapter.id,
      lessonId: home.written.id,
      position: 2,
    });

    await page.goto(`${other.chapterPath}/l/${home.written.slug}`);

    await expect
      .poll(() => readHead(page))
      .toMatchObject({ canonical: `${SITE_URL}${home.lessonPath}` });
  });
});

test.describe("public Library chapter and course pages", () => {
  test("lists a chapter's lessons with ItemList structured data", async ({ page }) => {
    const { chapterPath, id } = await createLibraryCourse();
    await page.goto(chapterPath);

    await expect(
      page.getByRole("heading", { level: 1, name: `Inside the atom ${id}` }),
    ).toBeVisible();

    await expect(page.getByText(`Explain why atoms are stable ${id}`)).toBeVisible();
    await expect(page.getByText("Chapter 2 of 2", { exact: false })).toBeVisible();

    await expect(page.getByRole("button", { name: "Start the chapter" })).toBeVisible();

    const items = await readStructuredData(page);
    const lessonList = items.find((item) => item["@type"] === "ItemList");

    expect(lessonList).toMatchObject({ name: `Inside the atom ${id}`, numberOfItems: 2 });
    expect(items).toContainEqual(expect.objectContaining({ "@type": "BreadcrumbList" }));
  });

  test("shows the full outline with Course structured data", async ({ page, request }) => {
    const { course, coursePath, id } = await createLibraryCourse();
    const response = await request.get(coursePath);
    const html = await response.text();

    expect(html).toContain(`Waves ${id}`);
    expect(html).toContain(`Inside the atom ${id}`);
    expect(html).toContain(`How do electrons fill the shells ${id}`);

    await page.goto(coursePath);
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

    const items = await readStructuredData(page);

    expect(items).toContainEqual(
      expect.objectContaining({
        "@type": "Course",
        name: course.title,
        provider: expect.objectContaining({ name: "Zoonk" }),
      }),
    );
  });

  test("offers the course's start at the top and at the end", async ({ page }) => {
    const { coursePath } = await createLibraryCourse();
    await page.goto(coursePath);

    // Starting it is covered in onboarding-course-start.test.ts.
    await expect(page.getByRole("button", { name: "Start this course" })).toHaveCount(2);
  });

  test("folds the full outline away and opens it on a tap", async ({ page }) => {
    const { chapterPath, coursePath, id, unwrittenPath } = await createLibraryCourse();
    await page.goto(coursePath);

    const lesson = page.getByRole("link", { name: `How do electrons fill the shells ${id}` });

    await expect(page.getByRole("link", { name: `Inside the atom ${id}` })).toHaveAttribute(
      "href",
      chapterPath,
    );

    await expect(lesson).toBeHidden();
    await page.getByText("See all chapters and lessons").click();
    await expect(lesson).toHaveAttribute("href", unwrittenPath);
  });

  test("previews one of its lessons without giving away the answer", async ({ page, request }) => {
    const { coursePath } = await createLibraryCourse();
    const response = await request.get(coursePath);
    const html = await response.text();

    expect(html).toContain("Does the electron circle the nucleus like Earth circles the Sun?");
    expect(html).not.toContain(REVEAL);
    expect(html).not.toContain(WRONG_REASON);
    expect(html).not.toContain("isCorrect");

    await page.goto(coursePath);

    await expect(
      page.getByText("Does the electron circle the nucleus like Earth circles the Sun?"),
    ).toBeVisible();
  });

  test("keeps a start button at the bottom of a phone once the first one scrolls away", async ({
    page,
  }) => {
    const { coursePath } = await createLibraryCourse();

    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto(coursePath);

    const bottomStart = page.getByRole("button", { name: "Start this course" });

    // The hero's and the closing call's buttons; the bottom bar's is hidden until it's needed.
    await expect(bottomStart).toHaveCount(2);

    await page.getByRole("heading", { name: "What you'll learn" }).scrollIntoViewIfNeeded();
    await expect(bottomStart).toHaveCount(3);

    // The closing call's button is on screen again, so the bottom bar steps aside.
    await page
      .getByText("Free to start. No account needed for your first lesson.")
      .last()
      .scrollIntoViewIfNeeded();

    await expect(bottomStart).toHaveCount(2);
  });

  test("shows the course's description and what you'll be able to do from its details", async ({
    page,
  }) => {
    const { course, coursePath, id } = await createLibraryCourse();

    const outcomes = [
      `Explain why atoms don't collapse ${id}`,
      `Predict where an electron is ${id}`,
    ];

    // The shape the course details step stores once the first outline band lands.
    await prisma.course.update({
      data: {
        landingPage: {
          audience: ["Curious adults who read science news"],
          outcomes,
          valueProposition: "See why the smallest things behave so strangely.",
        },
      },
      where: { id: course.id },
    });

    await page.goto(coursePath);

    await expect(
      page.getByText("See why the smallest things behave so strangely.", { exact: true }),
    ).toBeVisible();

    await expect(page.getByText(`How the smallest things behave ${id}`)).toBeVisible();

    await expect(
      page.getByRole("region", { name: "What you'll be able to do" }).getByRole("listitem"),
    ).toHaveText(outcomes);

    await expect(
      page.getByRole("region", { name: "Who it's for" }).getByRole("listitem"),
    ).toHaveText(["Curious adults who read science news"]);

    const items = await readStructuredData(page);

    expect(items).toContainEqual(
      expect.objectContaining({
        "@type": "Course",
        description: `How the smallest things behave ${id}`,
      }),
    );
  });

  test("lists a Library course with its description on its category's page", async ({ page }) => {
    // Category pages are prerendered, so this reads the seeded Library course (read-only).
    await page.goto("/courses/science");

    const course = page.getByRole("link", { name: /Quantum physics from scratch/u });

    await expect(course).toBeVisible();
    await expect(course).toContainText("one short lesson at a time");
    await expect(course).toHaveAttribute("href", /\/c\/quantum-physics-from-scratch$/u);
  });

  test("a signed-in learner votes on the course and the chapter from their menus", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { chapter, chapterPath, course, coursePath } = await createLibraryCourse();

    const findVote = (contentId: string) =>
      prisma.contentFeedback.findFirst({ where: { contentId, userId: noProgressUser.id } });

    await page.goto(coursePath);
    await page.getByRole("button", { name: "Course options" }).click();
    await page.getByRole("menuitemcheckbox", { exact: true, name: "Helpful" }).click();

    await expect
      .poll(() => findVote(course.id))
      .toMatchObject({ contentKind: "course", vote: "up" });

    await page.goto(chapterPath);
    await page.getByRole("button", { name: "Chapter options" }).click();
    await page.getByRole("menuitemcheckbox", { exact: true, name: "Not helpful" }).click();
    await page.getByRole("button", { name: "Skip" }).click();

    await expect
      .poll(() => findVote(chapter.id))
      .toMatchObject({ contentKind: "chapter", reasons: [], vote: "down" });
  });

  test("lists other editions of the course as language alternates", async ({ page }) => {
    const { course, coursePath } = await createLibraryCourse();
    const org = await getAiOrganization();
    const family = await prisma.courseFamily.create({ data: {} });

    const edition = await courseFixture({
      familyId: family.id,
      isPublished: true,
      language: "pt",
      organizationId: org.id,
      slug: `e2e-fisica-quantica-${randomUUID().slice(0, 8)}`,
    });

    await prisma.course.update({ data: { familyId: family.id }, where: { id: course.id } });
    await page.goto(coursePath);

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.querySelector<HTMLLinkElement>("link[rel='alternate'][hreflang='pt']")?.href,
        ),
      )
      .toBe(`${SITE_URL}/pt/b/${org.slug}/c/${edition.slug}`);

    // Read in Portuguese, the page points to the Portuguese edition.
    await page.goto(`/pt${coursePath}`);

    await expect(
      page.getByRole("link", { name: "Este curso também está disponível no seu idioma." }),
    ).toHaveAttribute("href", `/pt/b/${org.slug}/c/${edition.slug}`);
  });
});

test.describe("moved chapter and lesson URLs", () => {
  test("a chapter that no longer exists moves to its course page", async ({ page }) => {
    const { coursePath } = await createLibraryCourse();
    await page.goto(`${coursePath}/ch/deleted-chapter`);
    await expect(page).toHaveURL(new RegExp(`${coursePath}$`, "u"));
  });

  test("a lesson that no longer exists moves to its course page", async ({ page }) => {
    const { chapterPath, coursePath } = await createLibraryCourse();
    await page.goto(`${chapterPath}/l/deleted-lesson`);
    await expect(page).toHaveURL(new RegExp(`${coursePath}$`, "u"));
  });
});

test.describe("Library sitemaps", () => {
  test("list lessons at their home placement with when they last changed", async () => {
    const { lessonPath } = await createLibraryCourse();
    const robotsResponse = await fetch(`${getBaseURL()}/robots.txt`);
    const robots = await robotsResponse.text();

    expect(robots).toContain(
      "Sitemap: https://www.zoonk.com/sitemaps/library-lessons/sitemap/0.xml",
    );

    expect(robots).toContain("Disallow: /learn/");

    const pages = robots
      .split("\n")
      .filter((line) => line.includes("/sitemaps/library-lessons/"))
      .map((line) => line.replace("Sitemap: https://www.zoonk.com", ""));

    const bodies = await Promise.all(
      pages.map(async (path) => {
        const sitemap = await fetch(`${getBaseURL()}${path}`);
        return sitemap.text();
      }),
    );

    const entry = bodies
      .join("")
      .split("<url>")
      .find((item) => item.includes(`${SITE_URL}${lessonPath}<`));

    expect(entry).toContain("<lastmod>");
  });
});
