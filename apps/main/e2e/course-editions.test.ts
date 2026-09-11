import { randomUUID } from "node:crypto";
import { type CourseFormat, prisma } from "@zoonk/db";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { getCourseEditionPrompt } from "../../../packages/core/src/courses/_utils/edition-prompt";
import { expect, test } from "./fixtures";
import {
  getGenerationTriggerRequests,
  isGenerationEvents,
  isGenerationTrigger,
  routeGenerationApis,
} from "./generation-api";

async function createCourse({
  format = "core",
  language = "pt",
  targetLanguage,
}: { format?: CourseFormat; language?: string; targetLanguage?: string } = {}) {
  const organization = await getAiOrganization();
  const id = randomUUID();
  const title = language === "pt" ? `Ciência da Computação ${id}` : `Computer Science ${id}`;

  const course = await courseFixture({
    format,
    isPublished: true,
    language,
    normalizedTitle: normalizeString(title),
    organizationId: organization.id,
    slug: language === "pt" ? `ciencia-da-computacao-${id}-pt` : `computer-science-${id}`,
    targetLanguage: targetLanguage ?? null,
    title,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    language,
    organizationId: organization.id,
    title: `Introduction ${id}`,
  });

  return { chapter, course, href: `/b/${AI_ORG_SLUG}/c/${course.slug}` };
}

async function connectKnownPrompt({
  source,
  target,
}: {
  source: Awaited<ReturnType<typeof createCourse>>;
  target: Awaited<ReturnType<typeof createCourse>>;
}) {
  return coursePromptFixture({
    canonicalTitle: target.course.title,
    courseId: target.course.id,
    generationStatus: "completed",
    language: target.course.language,
    prompt: getCourseEditionPrompt(source.course),
  });
}

test.describe("Course language editions", () => {
  test("links an existing local edition on demand and opens its own localized slug", async ({
    page,
  }) => {
    const [source, target] = await Promise.all([createCourse(), createCourse({ language: "en" })]);
    await connectKnownPrompt({ source, target });

    await page.goto(source.href);

    await expect(page).toHaveURL(target.href);
    await expect(page.getByRole("heading", { level: 1, name: target.course.title })).toBeVisible();

    await expect(async () => {
      const [sourceCourse, targetCourse] = await Promise.all([
        prisma.course.findUniqueOrThrow({ where: { id: source.course.id } }),
        prisma.course.findUniqueOrThrow({ where: { id: target.course.id } }),
      ]);

      expect(sourceCourse.familyId).not.toBeNull();
      expect(sourceCourse.familyId).toBe(targetCourse.familyId);
    }).toPass();
  });

  test("offers a local course without generating on visit and keeps an explicit original choice", async ({
    page,
  }) => {
    const source = await createCourse();
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(source.href);

    const languageChoice = page.getByRole("region", { name: "Course language" });
    await expect(languageChoice.getByRole("button", { name: "Learn in English" })).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(source.chapter.title, "u") }),
    ).toHaveCount(0);

    await expect(
      prisma.courseEditionRequest.count({ where: { sourceCourseId: source.course.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.coursePrompt.count({
        where: {
          language: "en",
          normalizedPrompt: normalizeString(getCourseEditionPrompt(source.course)),
        },
      }),
    ).resolves.toBe(0);

    await expect(
      getGenerationTriggerRequests({ page, targetType: "coursePrompt" }),
    ).resolves.toHaveLength(0);

    await languageChoice.getByRole("link", { name: "Continue in Portuguese" }).click();

    await expect(page).toHaveURL(`${source.href}?edition=original`);

    await expect(
      page.getByRole("link", { name: new RegExp(source.chapter.title, "u") }),
    ).toBeVisible();

    await expect(
      languageChoice.getByRole("heading", { name: "This course is in Portuguese" }),
    ).toBeVisible();

    await expect(
      prisma.courseEditionRequest.count({ where: { sourceCourseId: source.course.id } }),
    ).resolves.toBe(0);
  });

  test("requires sign-in before resolving an unknown edition", async ({ page }) => {
    const source = await createCourse();

    await page.route("**/auth/login**", async (route) => {
      await route.fulfill({ body: "Auth app", contentType: "text/html", status: 200 });
    });

    const authRequest = page.waitForRequest("**/auth/login**");
    await page.goto(source.href);
    await page.getByRole("button", { name: "Learn in English" }).click();

    const request = await authRequest;
    await expect(page.getByText("Auth app", { exact: true })).toBeVisible();

    const authUrl = new URL(request.url());
    const callbackUrl = new URL(authUrl.searchParams.get("redirectTo") ?? "");

    expect(authUrl.searchParams.get("locale")).toBe("en");
    expect(callbackUrl.searchParams.get("next")).toBe(source.href);

    await expect(
      prisma.courseEditionRequest.count({ where: { sourceCourseId: source.course.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.coursePrompt.count({
        where: {
          language: "en",
          normalizedPrompt: normalizeString(getCourseEditionPrompt(source.course)),
        },
      }),
    ).resolves.toBe(0);
  });

  test("reuses an edition that appears after the initial page visit", async ({
    userWithoutProgress,
  }) => {
    const source = await createCourse();
    await userWithoutProgress.goto(source.href);

    await expect(
      userWithoutProgress.getByRole("button", { name: "Learn in English" }),
    ).toBeVisible();

    const target = await createCourse({ language: "en" });
    await connectKnownPrompt({ source, target });
    await userWithoutProgress.getByRole("button", { name: "Learn in English" }).click();

    await expect(userWithoutProgress).toHaveURL(target.href);

    await expect(
      userWithoutProgress.getByRole("heading", { level: 1, name: target.course.title }),
    ).toBeVisible();

    await expect(
      getGenerationTriggerRequests({ page: userWithoutProgress, targetType: "coursePrompt" }),
    ).resolves.toHaveLength(0);
  });

  for (const language of ["pt", "pt-BR"]) {
    test(`omits the language notice when Portuguese UI matches ${language} content`, async ({
      page,
    }) => {
      const [source, target] = await Promise.all([
        createCourse({ language }),
        createCourse({ language: "en" }),
      ]);

      await connectKnownPrompt({ source, target });
      await setLocale(page, "en");
      await page.goto(`/pt${source.href}`);

      await expect(page).toHaveURL(`/pt${source.href}`);

      await expect(
        page.getByRole("heading", { level: 1, name: source.course.title }),
      ).toBeVisible();

      await expect(
        page.getByRole("link", { name: new RegExp(source.chapter.title, "u") }),
      ).toBeVisible();

      await expect(page.getByRole("region", { name: "Idioma do curso" })).toHaveCount(0);
    });
  }

  test("keeps the requested locale in the sign-in return URL", async ({ page }) => {
    const source = await createCourse({ language: "en" });

    await page.route("**/auth/login**", async (route) => {
      await route.fulfill({ body: "Auth app", contentType: "text/html", status: 200 });
    });

    const authRequest = page.waitForRequest("**/auth/login**");
    await setLocale(page, "de");
    await page.goto(`/de${source.href}`);
    await page.getByRole("button", { name: "Auf Deutsch lernen" }).click();

    const request = await authRequest;
    await expect(page.getByText("Auth app", { exact: true })).toBeVisible();

    const authUrl = new URL(request.url());
    const callbackUrl = new URL(authUrl.searchParams.get("redirectTo") ?? "");

    expect(authUrl.searchParams.get("locale")).toBe("de");
    expect(callbackUrl.searchParams.get("next")).toBe(`/de${source.href}`);

    await expect(
      prisma.courseEditionRequest.count({ where: { sourceCourseId: source.course.id } }),
    ).resolves.toBe(0);
  });

  test("keeps the enrolled edition when opened from My Courses or a chapter", async ({
    noProgressUser,
    userWithoutProgress,
  }) => {
    const [source, target] = await Promise.all([createCourse(), createCourse({ language: "en" })]);

    await Promise.all([
      connectKnownPrompt({ source, target }),
      courseUserFixture({ courseId: source.course.id, userId: noProgressUser.id }),
    ]);

    await userWithoutProgress.goto("/my");

    await userWithoutProgress
      .getByRole("link", { name: new RegExp(source.course.title, "u") })
      .click();

    await expect(userWithoutProgress).toHaveURL(`${source.href}?edition=original`);

    await expect(
      userWithoutProgress.getByRole("heading", { level: 1, name: source.course.title }),
    ).toBeVisible();

    await userWithoutProgress
      .getByRole("link", { name: new RegExp(source.chapter.title, "u") })
      .click();

    await expect(userWithoutProgress).toHaveURL(`${source.href}/ch/${source.chapter.slug}`);
    await userWithoutProgress.getByRole("link", { exact: true, name: source.course.title }).click();

    await expect(userWithoutProgress).toHaveURL(`${source.href}?edition=original`);

    await userWithoutProgress
      .getByRole("region", { name: "Course language" })
      .getByRole("link", { name: "Learn in English" })
      .click();

    await expect(userWithoutProgress).toHaveURL(target.href);

    await expect(
      userWithoutProgress.getByRole("heading", { level: 1, name: target.course.title }),
    ).toBeVisible();
  });

  test("does not offer to teach a language through itself", async ({ page }) => {
    const source = await createCourse({ format: "language", targetLanguage: "en" });
    await page.goto(source.href);

    const languageChoice = page.getByRole("region", { name: "Course language" });

    await expect(languageChoice).toContainText(
      "This course teaches English, with explanations in Portuguese.",
    );

    await expect(languageChoice.getByRole("button", { name: "Learn in English" })).toHaveCount(0);
    await languageChoice.getByRole("link", { name: "Continue in Portuguese" }).click();
    await expect(page).toHaveURL(`${source.href}?edition=original`);

    await expect(
      page.getByRole("link", { name: new RegExp(source.chapter.title, "u") }),
    ).toBeVisible();
  });

  test("recovers the original zero-chapter course in the current UI language", async ({
    userWithoutProgress,
  }) => {
    const source = await createCourse({ language: "en" });

    await Promise.all([
      prisma.chapter.delete({ where: { id: source.chapter.id } }),
      prisma.course.update({
        data: { generationStatus: "running" },
        where: { id: source.course.id },
      }),
    ]);

    const prompt = await coursePromptFixture({
      canonicalTitle: source.course.title,
      courseId: source.course.id,
      generationRunId: null,
      generationStatus: "running",
      language: "en",
    });

    // Exercise the real source-prompt lookup and recovery trigger while keeping
    // the external generation service from producing content during E2E.
    await routeGenerationApis({
      handler: async (route) => {
        if (isGenerationTrigger({ request: route.request(), targetType: "coursePrompt" })) {
          await route.fulfill({
            body: JSON.stringify({ id: `recovery-${prompt.id}`, status: "pending" }),
            contentType: "application/json",
            status: 202,
          });

          return;
        }

        if (isGenerationEvents(route.request().url())) {
          await route.fulfill({
            body: `data: ${JSON.stringify({ status: "started", step: "getCoursePrompt" })}\n\n`,
            contentType: "text/event-stream",
            status: 200,
          });

          return;
        }

        await route.continue();
      },
      page: userWithoutProgress,
    });

    await userWithoutProgress.goto(`/pt${source.href}?edition=original`);
    await expect(userWithoutProgress).toHaveURL(`/pt/generate/course/${prompt.id}`);

    await expect
      .poll(() =>
        getGenerationTriggerRequests({ page: userWithoutProgress, targetType: "coursePrompt" }),
      )
      .toHaveLength(1);

    const [trigger] = await getGenerationTriggerRequests({
      page: userWithoutProgress,
      targetType: "coursePrompt",
    });

    expect(trigger?.postDataJSON()).toEqual({ target: { id: prompt.id, type: "coursePrompt" } });
  });

  test("follows a winning generation run and its real Portuguese slug without a completion event", async ({
    userWithoutProgress,
  }) => {
    const target = await createCourse({ format: "language", targetLanguage: "ja" });
    const originalRunId = `original-${randomUUID()}`;
    const winningRunId = `winning-${randomUUID()}`;

    await prisma.course.update({
      data: { generationRunId: winningRunId, generationStatus: "running" },
      where: { id: target.course.id },
    });

    const prompt = await coursePromptFixture({
      canonicalTitle: `A different generated title ${randomUUID()}`,
      courseFormat: "language",
      generationRunId: originalRunId,
      generationStatus: "running",
      language: "pt",
      targetLanguage: "ja",
    });

    // The workflow service is the external boundary; its durable handoff and
    // completion are persisted exactly as the real workflow writes them.
    await routeGenerationApis({
      handler: async (route) => {
        const url = new URL(route.request().url());

        if (!isGenerationEvents(url.toString())) {
          await route.continue();
          return;
        }

        if (url.pathname.includes(originalRunId)) {
          await prisma.coursePrompt.updateMany({
            data: { courseId: target.course.id, generationRunId: winningRunId },
            where: { generationRunId: originalRunId, id: prompt.id },
          });
        }

        if (url.pathname.includes(winningRunId)) {
          await Promise.all([
            prisma.course.update({
              data: { generationStatus: "completed" },
              where: { id: target.course.id },
            }),
            prisma.coursePrompt.update({
              data: { generationStatus: "completed" },
              where: { id: prompt.id },
            }),
          ]);
        }

        await route.fulfill({
          body: `data: ${JSON.stringify({ status: "started", step: "getCoursePrompt" })}\n\n`,
          contentType: "text/event-stream",
          status: 200,
        });
      },
      page: userWithoutProgress,
    });

    await userWithoutProgress.goto(`/pt/generate/course/${prompt.id}`);

    await expect(userWithoutProgress).toHaveURL(`/pt${target.href}?edition=original`, {
      timeout: 20_000,
    });

    await expect(
      userWithoutProgress.getByRole("heading", { level: 1, name: target.course.title }),
    ).toBeVisible();

    await expect(
      getGenerationTriggerRequests({ page: userWithoutProgress, targetType: "coursePrompt" }),
    ).resolves.toHaveLength(0);
  });

  test("keeps a retry active while the old failure is stored and then follows the winning run", async ({
    userWithoutProgress,
  }) => {
    const target = await createCourse();
    const retryRunId = `retry-${randomUUID()}`;
    const winningRunId = `winning-${randomUUID()}`;
    const releaseRetryStream = Promise.withResolvers<null>();

    await prisma.course.update({
      data: { generationRunId: winningRunId, generationStatus: "running" },
      where: { id: target.course.id },
    });

    const prompt = await coursePromptFixture({
      canonicalTitle: `Retried course ${randomUUID()}`,
      generationRunId: null,
      generationStatus: "failed",
      language: "pt",
    });

    // A retried workflow may still be resolving identity when the first real
    // prompt poll sees the previous failure. Hold only the external event stream;
    // the server action reads the actual database throughout this handoff.
    await routeGenerationApis({
      handler: async (route) => {
        if (isGenerationTrigger({ request: route.request(), targetType: "coursePrompt" })) {
          await route.fulfill({
            body: JSON.stringify({ id: retryRunId, status: "pending" }),
            contentType: "application/json",
            status: 202,
          });

          return;
        }

        const url = new URL(route.request().url());

        if (
          route.request().method() === "GET" &&
          url.pathname === `/v1/generations/${retryRunId}`
        ) {
          await route.fulfill({
            body: JSON.stringify({ id: retryRunId, status: "running" }),
            contentType: "application/json",
            status: 200,
          });

          return;
        }

        if (!isGenerationEvents(url.toString())) {
          await route.continue();
          return;
        }

        if (url.pathname.includes(retryRunId)) {
          await releaseRetryStream.promise;
        }

        if (url.pathname.includes(winningRunId)) {
          await Promise.all([
            prisma.course.update({
              data: { generationStatus: "completed" },
              where: { id: target.course.id },
            }),
            prisma.coursePrompt.update({
              data: { generationStatus: "completed" },
              where: { id: prompt.id },
            }),
          ]);
        }

        await route.fulfill({
          body: `data: ${JSON.stringify({ status: "started", step: "getCoursePrompt" })}\n\n`,
          contentType: "text/event-stream",
          status: 200,
        });
      },
      page: userWithoutProgress,
    });

    await userWithoutProgress.goto(`/pt/generate/course/${prompt.id}`);

    await expect
      .poll(
        async () => {
          const requests = await userWithoutProgress.requests();

          return requests.filter(
            (request) =>
              request.method() === "POST" &&
              Boolean(request.headers()["next-action"]) &&
              new URL(request.url()).pathname === `/pt/generate/course/${prompt.id}`,
          ).length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(2);

    await expect(
      prisma.coursePrompt.findUniqueOrThrow({ where: { id: prompt.id } }),
    ).resolves.toMatchObject({ generationStatus: "failed" });

    await prisma.coursePrompt.update({
      data: {
        courseId: target.course.id,
        generationRunId: winningRunId,
        generationStatus: "running",
      },
      where: { id: prompt.id },
    });

    releaseRetryStream.resolve(null);

    await expect(userWithoutProgress).toHaveURL(`/pt${target.href}?edition=original`, {
      timeout: 20_000,
    });

    await expect(
      userWithoutProgress.getByRole("heading", { level: 1, name: target.course.title }),
    ).toBeVisible();

    await expect(
      getGenerationTriggerRequests({ page: userWithoutProgress, targetType: "coursePrompt" }),
    ).resolves.toHaveLength(1);
  });
});

test.describe("Browser language preferences for course editions", () => {
  test.use({ locale: "de-DE" });

  test("omits browser-language suggestions when the UI and course languages match", async ({
    page,
  }) => {
    const [source, target] = await Promise.all([
      createCourse({ language: "en" }),
      createCourse({ language: "de" }),
    ]);

    await connectKnownPrompt({ source, target });
    await page.goto("/courses");
    await expect(page).toHaveURL("/de/courses");

    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name === LOCALE_COOKIE)).toBe(false);

    await page.goto(source.href);

    await expect(page).toHaveURL(source.href);
    await expect(page.getByRole("heading", { level: 1, name: source.course.title })).toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(source.chapter.title, "u") }),
    ).toBeVisible();

    await expect(page.getByRole("region", { name: "Course language" })).toHaveCount(0);

    await expect(
      getGenerationTriggerRequests({ page, targetType: "coursePrompt" }),
    ).resolves.toHaveLength(0);
  });
});
