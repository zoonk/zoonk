import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
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
import { type Page, expect, test } from "./fixtures";

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
        reveal: "It spreads out into a cloud of places where it could be.",
        variant: "guess",
      },
      kind: "hook",
      lessonId: written.id,
      position: 0,
    }),
    libraryStepFixture({
      content: { text: "This second screen only loads in the player." },
      kind: "explanation",
      lessonId: written.id,
      position: 1,
    }),
    libraryStepFixture({
      content: {
        options: [
          { id: "a", isCorrect: true, reason: "Right.", text: "A cloud" },
          {
            id: "b",
            isCorrect: false,
            reason: "A planet would give off light and spiral in.",
            text: "A planet",
          },
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

test.describe("public Library lesson page", () => {
  test("starts a lesson that isn't written yet only on a tap, and plays it once written", async ({
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
});

test.describe("public Library chapter and course pages", () => {
  test("keeps a course's description inside its structured data, where it can't add markup", async ({
    request,
  }) => {
    const { course, coursePath, id } = await createLibraryCourse();

    const description = `How the smallest things behave ${id}: </script><h1>Injected heading ${id}</h1><script type="application/ld+json">`;

    await prisma.course.update({ data: { description }, where: { id: course.id } });

    const response = await request.get(coursePath);
    const html = await response.text();
    // Crawlers read the server HTML before hydration can repair script breakout markup.
    const serverItems = [
      ...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(?<json>.*?)<\/script>/gsu),
    ].map((match) => JSON.parse(match.groups?.json ?? "") as Record<string, unknown>);

    expect(serverItems).toContainEqual(expect.objectContaining({ "@type": "Course", description }));
  });
});
