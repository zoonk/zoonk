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
import { openAsGuest } from "./guest-session";

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
    firstChapter,
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

/**
 * The IDs more than one element in the document has. Moving inside the app keeps the pages a
 * visitor left in the document, hidden, so each page's IDs must be its own.
 */
async function readRepeatedIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  });
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

    // What you'll learn stays one tap away; on a wide screen the rest of the chapter is beside
    // the lesson, in the app's aside.
    const idea = page.getByText(`The planet picture can't work ${id}`);
    const otherLesson = page.getByRole("link", { name: `How do electrons fill the shells ${id}` });

    await expect(idea).toBeHidden();
    await expect(otherLesson).toBeVisible();

    await page.getByText("What you'll learn").click();
    await expect(idea).toBeVisible();

    // Under the lesson, one day of its course's plan with this lesson under way between its
    // chapter's lessons, and a quieter way to build that plan.
    const planDay = page.getByRole("region", {
      name: `This lesson is part of the ${course.title} course.`,
    });

    await expect(planDay.getByRole("listitem")).toHaveText([
      new RegExp(`^Why doesn't the electron fall into the nucleus ${id}`, "u"),
      new RegExp(`^How do electrons fill the shells ${id}`, "u"),
    ]);

    await expect(planDay.getByRole("link", { name: "Build my plan" })).toBeVisible();

    await expectAccessibleScreen(page, "a public lesson with what it teaches open");

    // On a phone the chapter folds under the question instead, one tap away.
    await page.setViewportSize({ height: 812, width: 375 });
    await expect(otherLesson).toBeHidden();
    await page.getByText(`Chapter 2: Inside the atom ${id}`).click();
    await expect(otherLesson).toBeVisible();
    await page.setViewportSize({ height: 720, width: 1280 });

    // Any answer to the first question opens the player with that answer.
    const question = page.getByRole("form", {
      name: "Does the electron circle the nucleus like Earth circles the Sun?",
    });

    // The answer opens the player with the page it was given on, which closing the lesson returns to.
    const playerRequest = page.waitForRequest((sent) =>
      sent
        .url()
        .includes(`/learn/${written.id}?from=${encodeURIComponent(lessonPath)}&answer=cloud`),
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
    // The lesson remembers the page it was started from, which closing it returns to.
    await expect(page).toHaveURL(
      new RegExp(
        `/learn/${unwritten.id}\\?generation=${runId}&from=${encodeURIComponent(unwrittenPath)}$`,
        "u",
      ),
    );

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

  test("names each lesson and chapter by its own content after moving between them in the app", async ({
    page,
  }) => {
    const { coursePath, firstChapter, id, lessonPath } = await createLibraryCourse();
    const question = "Does the electron circle the nucleus like Earth circles the Sun?";

    await page.goto(lessonPath);
    await expect(page.getByRole("form", { name: question })).toBeVisible();

    await page
      .getByRole("link", { name: new RegExp(`How do electrons fill the shells ${id}`, "u") })
      .first()
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: `How do electrons fill the shells ${id}` }),
    ).toBeVisible();

    await expect.poll(() => readRepeatedIds(page)).toStrictEqual([]);

    // Back on the first lesson, its answers are named by its own question.
    await page.goBack();
    await expect(page.getByRole("form", { name: question })).toBeVisible();
    await expect.poll(() => readRepeatedIds(page)).toStrictEqual([]);

    await page.goto(`${coursePath}/ch/${firstChapter.slug}`);

    await page
      .getByRole("navigation", { name: "After this chapter" })
      .getByRole("link", { name: `Inside the atom ${id}` })
      .click();

    await expect(
      page.getByRole("heading", { level: 1, name: `Inside the atom ${id}` }),
    ).toBeVisible();

    await expect.poll(() => readRepeatedIds(page)).toStrictEqual([]);
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

    // The first screen says the plan starts at this chapter, and builds it.
    const hero = page.getByRole("region", { name: `Inside the atom ${id}` });

    await expect(
      hero.getByText("With Zoonk, your plan starts at this chapter and fits your schedule."),
    ).toBeVisible();

    await expect(hero.getByRole("link", { name: "Build my plan" })).toBeVisible();

    // Where it sits in its course, at a glance.
    await expect(
      page
        .getByRole("region", { name: "Where this chapter sits in the course" })
        .getByRole("img", { name: "Chapter 2 of 2 · Beginner" }),
    ).toBeVisible();

    // Its lessons are on the page, one link each, beside a question from one of them to try.
    await expect(
      page
        .getByRole("region", { name: "Lessons" })
        .getByRole("link", { name: new RegExp(`How do electrons fill the shells ${id}`, "u") }),
    ).toBeVisible();

    await expect(
      page
        .getByRole("region", { name: "Try a lesson · free · 5 min" })
        .getByRole("form", {
          name: "Does the electron circle the nucleus like Earth circles the Sun?",
        }),
    ).toBeVisible();

    // It ends with the plan this chapter starts.
    await expect(
      page
        .getByRole("region", { name: "Your plan from this chapter" })
        .getByRole("link", { name: "Build my plan" }),
    ).toBeVisible();

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
    const { chapterPath, course, coursePath, firstChapter, id, unwrittenPath, written } =
      await createLibraryCourse();

    // The first chapter gets a single lesson, which stands alone on its line in the outline.
    const loneLesson = await libraryLessonFixture({
      homeChapterId: firstChapter.id,
      slug: `standing-waves-${id}`,
      title: `Standing waves ${id}`,
    });

    await chapterLessonFixture({
      chapterId: firstChapter.id,
      lessonId: loneLesson.id,
      position: 0,
    });

    const outcomes = [
      `Explain why atoms don't collapse ${id}`,
      `Predict where an electron is ${id}`,
    ];

    const description = `How the smallest things behave ${id}: </script><h1>Injected heading ${id}</h1><script type="application/ld+json">`;

    // The shape the course details step stores once the first outline band lands.
    await prisma.course.update({
      data: {
        description,
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
    // Crawlers read the server HTML before hydration can repair script breakout markup.
    const serverItems = [
      ...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(?<json>.*?)<\/script>/gsu),
    ].map((match) => JSON.parse(match.groups?.json ?? "") as Record<string, unknown>);

    expect(serverItems).toContainEqual(expect.objectContaining({ "@type": "Course", description }));

    expect(html).toContain(`Waves ${id}`);
    expect(html).toContain(`Inside the atom ${id}`);
    expect(html).toContain(`How do electrons fill the shells ${id}`);
    expect(html).not.toContain(REVEAL);
    expect(html).not.toContain(WRONG_REASON);
    expect(html).not.toContain("isCorrect");

    await page.goto(coursePath);
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
    // Authored text stays text, including HTML-learning examples that could close a script tag.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    await expect(
      page.getByText("See why the smallest things behave so strangely.", { exact: true }),
    ).toBeVisible();

    // The first screen says what Zoonk does with the course, and its one way in.
    const hero = page.getByRole("region", { name: course.title });

    await expect(
      hero.getByText("With Zoonk, your plan starts at your level and fits your schedule."),
    ).toBeVisible();

    await expect(hero.getByRole("link", { name: "Build my plan" })).toBeVisible();

    // "Try a lesson" leads down to the course's first written question, answerable right there.
    await hero.getByRole("link", { name: "Try a lesson" }).click();
    const tryLesson = page.getByRole("region", { name: "Try a lesson · free · 5 min" });

    await expect(tryLesson).toBeInViewport();
    await expect(tryLesson.getByText(`Inside the atom ${id} · lesson 1`)).toBeVisible();

    await expect(
      tryLesson.getByRole("form", {
        name: "Does the electron circle the nucleus like Earth circles the Sun?",
      }),
    ).toBeVisible();

    await expect(page.getByText(description, { exact: true })).toBeVisible();

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
        description,
        name: course.title,
        provider: expect.objectContaining({ name: "Zoonk" }),
      }),
    );

    // The full outline opens on its first level and folds each level away on a tap, every
    // chapter and lesson a link.
    const outline = page.getByRole("region", { name: "Course outline" });
    const chapter = outline.getByRole("link", { name: `Inside the atom ${id}` });
    const lesson = outline.getByRole("link", { name: `How do electrons fill the shells ${id}` });

    await expect(lesson).toBeVisible();
    await expect(chapter).toHaveAttribute("href", chapterPath);
    await expect(lesson).toHaveAttribute("href", unwrittenPath);
    await expectAccessibleScreen(page, "a public course with its full outline open");

    await outline.getByText("Beginner", { exact: true }).click();
    await expect(lesson).toBeHidden();
    await outline.getByText("Beginner", { exact: true }).click();
    await expect(lesson).toBeVisible();

    // A chapter's only lesson has its own target, which leaves the chapter's title to the
    // chapter: a tap on the title's lower part opens the chapter, not the lesson under it.
    const loneChapter = outline.getByRole("link", { exact: true, name: `Waves ${id}` });
    await loneChapter.scrollIntoViewIfNeeded();

    // Where the title's letters are, whatever the link's own box around them.
    const title = await loneChapter.evaluate((link) => {
      const text = document.createRange();
      text.selectNodeContents(link);
      const { bottom, left, width } = text.getBoundingClientRect();
      return { bottom, left, width };
    });

    await page.mouse.click(title.left + title.width / 2, title.bottom - 3);
    await expect(page).toHaveURL(`${coursePath}/ch/${firstChapter.slug}`);

    // The course's lesson to try takes its first answer into the player, like the lesson's page.
    await page.goto(coursePath);

    const playerRequest = page.waitForRequest((sent) =>
      sent
        .url()
        .includes(
          `/learn/${written.id}?from=${encodeURIComponent(`${coursePath}#try-lesson-${course.id}`)}&answer=cloud`,
        ),
    );

    await page
      .getByRole("region", { name: "Try a lesson · free · 5 min" })
      .getByRole("button", { name: "No, it's more like a cloud" })
      .click();

    await playerRequest;
  });

  test("opens a course in the app's frame, like Explore courses: back to the catalog, the tabs on a phone", async ({
    page,
  }) => {
    const { chapterPath, course, coursePath, id } = await createLibraryCourse();

    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto("/courses");
    await page.goto(coursePath);

    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toBeVisible();
    await expect(page.getByRole("link", { exact: true, name: "Zoonk" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");

    // The way back leads to the catalog, which keeps the same frame.
    await page.getByRole("link", { name: "Back to Explore courses" }).click();
    await expect(page).toHaveURL(/\/courses$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Explore courses" })).toBeVisible();

    // A chapter goes back to its course.
    await page.goto(chapterPath);

    await expect(
      page.getByRole("heading", { level: 1, name: `Inside the atom ${id}` }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: `Back to ${course.title}` })).toHaveAttribute(
      "href",
      coursePath,
    );
  });

  test("a visitor's sidebar goes home from the logo and has Pricing beside the way in", async ({
    page,
  }) => {
    const { coursePath } = await createLibraryCourse();

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(coursePath);

    const sidebar = page.getByRole("complementary", { name: "Sidebar" });

    await expect(sidebar.getByRole("link", { exact: true, name: "Zoonk" })).toHaveAttribute(
      "href",
      "/",
    );

    await expect(sidebar.getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "/pricing",
    );

    await expect(sidebar.getByRole("link", { name: "Log in" })).toBeVisible();

    await sidebar.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/u);
  });

  test("a guest who tries a lesson on a course's page goes back to that page on closing it", async ({
    browser,
  }) => {
    const { course, coursePath, written } = await createLibraryCourse();
    const { context, page } = await openAsGuest(browser);

    try {
      await page.goto(coursePath);

      await page
        .getByRole("region", { name: "Try a lesson · free · 5 min" })
        .getByRole("button", { name: "No, it's more like a cloud" })
        .click();

      await expect(page).toHaveURL(new RegExp(`/learn/${written.id}\\?`, "u"));
      await page.getByRole("link", { name: "Close lesson" }).click();
      // Back at the card the lesson was tried on, not the top of a long page.
      await expect(page).toHaveURL(new RegExp(`${coursePath}#try-lesson-${course.id}$`, "u"));
      await expect(page.getByRole("link", { name: "Build my plan" }).first()).toBeVisible();

      const card = page.getByRole("region", { name: "Try a lesson · free · 5 min" });
      await expect(card).toBeInViewport();

      // From a player opened afresh (a reload, a shared link), the card streams in after the
      // page commits, and closing still lands on it.
      await page.goto(
        `/learn/${written.id}?from=${encodeURIComponent(`${coursePath}#try-lesson-${course.id}`)}`,
      );

      await page.getByRole("link", { name: "Close lesson" }).click();
      await expect(page).toHaveURL(new RegExp(`${coursePath}#try-lesson-${course.id}$`, "u"));
      await expect(card).toBeInViewport();
    } finally {
      await context.close();
    }
  });

  test("a guest who leaves the tried lesson partway gets the way back in on the card, not the question again", async ({
    browser,
  }) => {
    const { course, coursePath, written } = await createLibraryCourse();
    const { context, page, user } = await openAsGuest(browser);
    const card = page.getByRole("region", { name: "Try a lesson · free · 5 min" });

    try {
      await page.goto(coursePath);
      await card.getByRole("button", { name: "No, it's more like a cloud" }).click();
      await expect(page).toHaveURL(new RegExp(`/learn/${written.id}\\?`, "u"));

      // The guess opens the lesson; its first check is answered, then the lesson is closed.
      await page.getByRole("button", { name: /^Continue/u }).click();
      await page.getByRole("button", { name: /^Next/u }).click();
      await expect(page.getByText("Which picture fits?")).toBeVisible();
      await page.getByRole("radio", { name: "A cloud" }).click();
      await page.getByRole("button", { name: /^Check/u }).click();
      await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
      await expect.poll(() => prisma.attempt.count({ where: { userId: user.id } })).toBe(1);

      await page.getByRole("link", { name: "Close lesson" }).click();
      await expect(page).toHaveURL(new RegExp(`${coursePath}#try-lesson-${course.id}$`, "u"));

      await expect(card.getByText("You've started this lesson.", { exact: false })).toBeVisible();
      await expect(card.getByRole("button", { name: "No, it's more like a cloud" })).toHaveCount(0);

      const resume = card.getByRole("link", { name: "Continue the lesson" });

      await expect(resume).toHaveAttribute(
        "href",
        `/learn/${written.id}?from=${encodeURIComponent(`${coursePath}#try-lesson-${course.id}`)}`,
      );

      // It picks up after the answered check.
      await resume.click();
      await expect(page).toHaveURL(new RegExp(`/learn/${written.id}\\?`, "u"));
      await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
      await expect(page.getByText("Which picture fits?")).toBeHidden();
    } finally {
      await context.close();
    }
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

    // A learner is in the app's frame: its sidebar with their goal, no public logo or way in, and
    // no note about starting without an account.
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    await expect(sidebar.getByRole("link", { name: "Start a goal" })).toBeVisible();
    await expect(page.getByRole("link", { exact: true, name: "Zoonk" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);

    await expect(
      page.getByText("Start free, no account needed.").filter({ visible: true }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Course options" }).click();
    await expect(page.getByRole("menu").getByRole("menuitemcheckbox")).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Report a problem" }).click();
    await expect(page.getByRole("dialog", { name: "Report a problem" })).toBeVisible();

    await page.goto(chapterPath);
    await expect(page.getByRole("button", { name: "Chapter options" })).toBeVisible();

    await expect(
      page.getByText("Start free, no account needed.").filter({ visible: true }),
    ).toHaveCount(0);

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
