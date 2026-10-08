import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
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
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { SITE_URL } from "@zoonk/utils/url";
import { type Page, expect, test } from "./fixtures";

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
  test("shows only the public part of the lesson, described with structured data, and its first answer opens the player", async ({
    page,
    request,
  }) => {
    const { course, id, lessonPath, written } = await createLibraryCourse();
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

    // What you'll learn and the rest of the chapter stay one tap away.
    const idea = page.getByText(`The planet picture can't work ${id}`);
    const otherLesson = page.getByRole("link", { name: `How do electrons fill the shells ${id}` });

    await expect(idea).toBeHidden();
    await expect(otherLesson).toBeHidden();

    await page.getByText("What you'll learn").click();
    await expect(idea).toBeVisible();

    await page.getByText(`Chapter 2: Inside the atom ${id}`).click();
    await expect(otherLesson).toBeVisible();
    await expectAccessibleScreen(page, "a public lesson with its outline open");

    // Any answer to the first question opens the player with that answer.
    const question = page.getByRole("form", {
      name: "Does the electron circle the nucleus like Earth circles the Sun?",
    });

    const playerRequest = page.waitForRequest((sent) =>
      sent.url().includes(`/learn/${written.id}?answer=cloud`),
    );

    await question.getByRole("button", { name: "No, it's more like a cloud" }).click();
    await playerRequest;
  });

  test("indexes a lesson that isn't written yet, starts it in one tap and plays it once written", async ({
    page,
  }) => {
    const { id, unwritten, unwrittenPath } = await createLibraryCourse();
    const { asked, runId } = await writeLessonWhenFollowed({ lessonId: unwritten.id, page });

    await page.goto(unwrittenPath);

    await expect(
      page.getByRole("heading", { level: 1, name: `How do electrons fill the shells ${id}` }),
    ).toBeVisible();

    const start = page.getByRole("button", { name: "Start this lesson" });
    await expect(start).toBeVisible();
    await expect.poll(() => readHead(page)).toMatchObject({ robots: "index, follow" });

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
    expect(asked).toHaveLength(1);

    const session = await page.request.get("/api/auth/get-session");
    expect(await session.json()).toMatchObject({ user: { isAnonymous: true } });

    // The lesson plays: its next screen is a question.
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(playableStepContent.check.question)).toBeVisible();
  });

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
    await expectAccessibleScreen(page, "a public chapter");
  });

  test("shows the course's details and the full outline on a tap, with Course structured data, and never a lesson's answers", async ({
    page,
    request,
  }) => {
    const { chapterPath, course, coursePath, id, unwrittenPath } = await createLibraryCourse();

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

    const response = await request.get(coursePath);
    const html = await response.text();

    expect(html).toContain(`Waves ${id}`);
    expect(html).toContain(`Inside the atom ${id}`);
    expect(html).toContain(`How do electrons fill the shells ${id}`);
    expect(html).not.toContain(REVEAL);
    expect(html).not.toContain(WRONG_REASON);
    expect(html).not.toContain("isCorrect");

    await page.goto(coursePath);
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

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
        name: course.title,
        provider: expect.objectContaining({ name: "Zoonk" }),
      }),
    );

    // The full outline folds away and opens on a tap, every chapter and lesson a link.
    const chapter = page.getByRole("link", { name: `Inside the atom ${id}` });
    const lesson = page.getByRole("link", { name: `How do electrons fill the shells ${id}` });

    await expect(lesson).toBeHidden();
    await page.getByText("See all chapters and lessons").click();
    await expect(chapter).toHaveAttribute("href", chapterPath);
    await expect(lesson).toHaveAttribute("href", unwrittenPath);
    await expectAccessibleScreen(page, "a public course with its full outline open");
  });

  test("keeps a start button at the bottom of a phone once the first one scrolls away", async ({
    page,
  }) => {
    const { course, coursePath } = await createLibraryCourse();

    // A course page as the details step leaves it, long enough to scroll past its first button.
    await prisma.course.update({
      data: {
        landingPage: {
          audience: ["Curious adults who read science news", "Students starting physics"],
          outcomes: ["Explain why atoms are stable", "Predict where an electron is"],
          valueProposition: "See why the smallest things behave so strangely.",
        },
      },
      where: { id: course.id },
    });

    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto(coursePath);

    const bottomStart = page.getByRole("button", { name: "Start this course" });

    // The hero's and the closing call's buttons; the bottom bar's is hidden until it's needed.
    await expect(bottomStart).toHaveCount(2);

    // What the course makes you able to do, at the top of the screen: the first button is gone.
    await page
      .getByRole("heading", { name: "What you'll be able to do" })
      .evaluate((heading) => heading.scrollIntoView({ block: "start" }));

    await expect(bottomStart).toHaveCount(3);

    // The closing call's button is on screen again, so the bottom bar steps aside.
    await page
      .getByText("Free to start. No account needed for your first lesson.")
      .last()
      .scrollIntoViewIfNeeded();

    await expect(bottomStart).toHaveCount(2);
  });

  test("lists a Library course with its description on its category's page", async ({ page }) => {
    // Category pages are prerendered, so this reads the seeded Library course (read-only).
    await page.goto("/courses/science");

    const course = page.getByRole("link", { name: /Quantum physics from scratch/u });

    await expect(course).toBeVisible();
    await expect(course).toContainText("one short lesson at a time");
    await expect(course).toHaveAttribute("href", /\/c\/quantum-physics-from-scratch$/u);
    await expectAccessibleScreen(page, "a catalog category");
  });

  test("a signed-in learner reports a problem from the course's and the chapter's menus, without votes", async ({
    userWithoutProgress: page,
  }) => {
    const { chapterPath, coursePath } = await createLibraryCourse();

    await page.goto(coursePath);

    // A learner is in the app: its account menu and goal instead of the logo, and no note about
    // starting without an account.
    const bar = page.getByRole("banner");
    await expect(bar.getByRole("link", { name: "Start a goal" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "User menu" })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Zoonk home page" })).toHaveCount(0);
    await expect(page.getByText("No account needed for your first lesson.")).toHaveCount(0);

    await page.getByRole("button", { name: "Course options" }).click();
    await expect(page.getByRole("menu").getByRole("menuitemcheckbox")).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Report a problem" }).click();
    await expect(page.getByRole("dialog", { name: "Report a problem" })).toBeVisible();

    await page.goto(chapterPath);
    await page.getByRole("button", { name: "Chapter options" }).click();

    await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText(["Report a problem"]);
    await expect(page.getByRole("menu").getByRole("menuitemcheckbox")).toHaveCount(0);
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
  test("a chapter or a lesson that no longer exists moves to its course page", async ({ page }) => {
    const { chapterPath, coursePath } = await createLibraryCourse();

    await page.goto(`${coursePath}/ch/deleted-chapter`);
    await expect(page).toHaveURL(new RegExp(`${coursePath}$`, "u"));

    await page.goto(`${chapterPath}/l/deleted-lesson`);
    await expect(page).toHaveURL(new RegExp(`${coursePath}$`, "u"));
  });

  test("a chapter or a lesson of a course that doesn't exist answers 404", async ({ page }) => {
    const coursePath = `/b/${AI_ORG_SLUG}/c/deleted-${randomUUID().slice(0, 8)}`;

    const [chapter, lesson] = await Promise.all([
      page.request.get(`${coursePath}/ch/a-chapter`),
      page.request.get(`${coursePath}/ch/a-chapter/l/a-lesson`),
    ]);

    expect([chapter.status(), lesson.status()]).toStrictEqual([404, 404]);
  });
});
