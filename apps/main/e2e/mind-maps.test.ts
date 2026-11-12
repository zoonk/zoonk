import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture, lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

/** A one-pixel picture, so the map has a thumbnail without a file to serve. */
const PICTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HJ4BAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const STRUCTURE = {
  branches: ["Nucleus", "Electron", "Empty space"].map((title) => ({
    drawing: title,
    explanation: `What ${title} means`,
    points: [title],
    title,
  })),
  centralIdea: "An atom is mostly empty",
  comparison: null,
  summary: "A tiny nucleus with electrons around it",
  title: "Inside the atom",
};

async function createChapter(goalSuffix: string, position: number) {
  const suffix = `${goalSuffix}-${position}`;

  const [chapter, skill, { lesson }] = await Promise.all([
    libraryChapterFixture({ title: `Inside the atom ${suffix}` }),
    skillFixture({ name: `Atoms ${suffix}` }),
    playableLessonFixture({ lesson: { title: "An almost empty atom" }, steps: ["explanation"] }),
  ]);

  await Promise.all([
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    prisma.lesson.update({ data: { homeChapterId: chapter.id }, where: { id: lesson.id } }),
  ]);

  return { chapter, lessonId: lesson.id, skillId: skill.id };
}

/** A learner whose plan has two chapters, each with one written lesson and no map. */
async function createLearner() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);

  const [goal, first, second] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Understand atoms ${suffix}`, userId: user.id }),
    createChapter(suffix, 1),
    createChapter(suffix, 2),
  ]);

  await Promise.all([
    planFixture({
      goalId: goal.id,
      items: [first, second].map(({ chapter, lessonId, skillId }) => ({
        chapterId: chapter.id,
        lessonId,
        skillId,
      })),
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  return { first, goal, second, user };
}

function saveChapterMap({
  chapter,
  goalId,
  userId,
}: {
  chapter: { id: string; title: string };
  goalId: string;
  userId: string;
}) {
  return prisma.savedMindMap.create({
    data: { goalId, kind: "chapter", targetId: chapter.id, title: chapter.title, userId },
  });
}

/** The model's part: the API's E2E build holds a workflow's model calls, so its run never ends. */
async function drawMap(chapterId: string) {
  const map = {
    imageHeight: 1,
    imageUrl: PICTURE,
    imageWidth: 1,
    status: "completed" as const,
    structure: STRUCTURE,
    thumbnailUrl: PICTURE,
  };

  await prisma.chapterMindMap.upsert({
    create: { ...map, chapterId, language: "en" },
    update: map,
    where: { chapterId },
  });
}

test.describe("Mind maps", () => {
  test("finishing a chapter shows its map row, which turns ready and opens the map", async ({
    browser,
  }) => {
    const { first, user } = await createLearner();
    const { chapter, lessonId } = first;
    const page = await openAs(browser, user);

    try {
      await page.goto(`/learn/${lessonId}`);
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      const next = page.getByRole("button", { name: /^Continue/u });
      await expectHydrated(next);
      await next.click();

      await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

      const finished = page.getByRole("region", { name: "Chapter finished" });
      await expect(finished.getByText(chapter.title)).toBeVisible();
      await expect(finished.getByText("Drawing the mind map…")).toBeVisible();

      await drawMap(chapter.id);

      await expect(finished.getByText("Mind map ready")).toBeVisible();
      await finished.getByRole("button", { name: /Open$/u }).click();

      const viewer = page.getByRole("dialog", { name: chapter.title });

      await expect(
        viewer.getByRole("img", { name: `Mind map: ${STRUCTURE.title}. ${STRUCTURE.centralIdea}` }),
      ).toBeVisible();

      // The outline is also in a hidden description for screen readers.
      await expect(viewer.getByText(STRUCTURE.summary).filter({ visible: true })).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test("a map saved while studying stays in Saved until the learner removes it", async ({
    browser,
  }) => {
    const { first, second, user } = await createLearner();

    await Promise.all([drawMap(first.chapter.id), drawMap(second.chapter.id)]);

    const page = await openAs(browser, user);
    const savedCount = () => prisma.savedMindMap.count({ where: { userId: user.id } });

    try {
      await page.goto("/mind-maps");
      await page.getByRole("link", { name: new RegExp(second.chapter.title, "u") }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: second.chapter.title }),
      ).toBeVisible();

      await page.getByRole("button", { exact: true, name: "Save" }).click();
      await expect(page.getByRole("button", { exact: true, name: "Saved" })).toBeVisible();
      await expect.poll(savedCount).toBe(1);

      await page.getByRole("button", { name: "Previous map" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: first.chapter.title }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Leave" }).click();

      // The router keeps the Study page it left alive; opening a map again starts on that map.
      await page.getByRole("link", { name: new RegExp(second.chapter.title, "u") }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: second.chapter.title }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Leave" }).click();

      await page
        .getByRole("navigation", { name: "Mind maps" })
        .getByRole("link", { name: /^Saved/u })
        .click();

      const saved = page.getByRole("list", { name: "Saved maps" });
      const savedMap = saved.getByRole("link", { name: new RegExp(second.chapter.title, "u") });

      await expect(savedMap).toBeVisible();
      await saved.getByRole("button", { name: "Saved" }).click();

      await expect(savedMap).toBeHidden();
      await expect.poll(savedCount).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  test("a map removed from Saved opens in Study as not saved, so one press saves it again", async ({
    browser,
  }) => {
    const { first, goal, second, user } = await createLearner();

    await Promise.all([
      drawMap(first.chapter.id),
      drawMap(second.chapter.id),
      saveChapterMap({ chapter: second.chapter, goalId: goal.id, userId: user.id }),
    ]);

    const page = await openAs(browser, user);
    const tabs = page.getByRole("navigation", { name: "Mind maps" });
    const tab = (name: string) => tabs.getByRole("link", { name: new RegExp(`^${name}`, "u") });
    const studyLink = page.getByRole("link", { name: new RegExp(second.chapter.title, "u") });
    const heading = page.getByRole("heading", { level: 1, name: second.chapter.title });
    const savedCount = () => prisma.savedMindMap.count({ where: { userId: user.id } });

    try {
      await page.goto("/mind-maps");
      await studyLink.click();
      await expect(heading).toBeVisible();
      await expect(page.getByRole("button", { exact: true, name: "Saved" })).toBeVisible();
      await page.getByRole("link", { name: "Leave" }).click();

      await tab("Saved").click();

      await page
        .getByRole("list", { name: "Saved maps" })
        .getByRole("button", { name: "Saved" })
        .click();

      await expect.poll(savedCount).toBe(0);

      await tab("Chapters").click();

      // Checked on every frame: an older copy shows "Saved" only until the next read, which a
      // retrying assertion would miss.
      const firstMark = page.waitForFunction(
        (title) => {
          const [shownTitle, button] = ["h1", '[data-slot="mind-map-save"]'].map((selector) =>
            [...document.querySelectorAll(selector)].find((element) => element.checkVisibility()),
          );

          return shownTitle?.textContent === title && button?.textContent;
        },
        second.chapter.title,
        { polling: "raf" },
      );

      await studyLink.click();
      const mark = await firstMark;
      expect(await mark.jsonValue()).toBe("Save");

      const save = page.getByRole("button", { exact: true, name: "Save" });
      await save.click();
      await expect.poll(savedCount).toBe(1);
    } finally {
      await page.context().close();
    }
  });

  test("Study opened again after another map turns ready studies both maps", async ({
    browser,
  }) => {
    const { first, second, user } = await createLearner();

    await drawMap(first.chapter.id);

    const page = await openAs(browser, user);
    const study = page.getByRole("link", { exact: true, name: "Study" });
    const heading = (title: string) => page.getByRole("heading", { level: 1, name: title });

    try {
      await page.goto("/mind-maps");
      await study.click();
      await expect(heading(first.chapter.title)).toBeVisible();
      await expect(page.getByRole("link", { name: "Done" })).toBeVisible();
      await page.getByRole("link", { name: "Leave" }).click();

      await page.getByRole("button", { name: /^Show chapters/u }).click();

      await page
        .getByRole("listitem")
        .filter({ hasText: second.chapter.title })
        .getByRole("button", { name: "Create" })
        .click();

      await expect(page.getByText(/1 on the way/u)).toBeVisible();
      await drawMap(second.chapter.id);

      await expect(
        page.getByRole("link", { name: new RegExp(second.chapter.title, "u") }),
      ).toBeVisible({ timeout: 15_000 });

      await study.click();
      await expect(heading(first.chapter.title)).toBeVisible();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(heading(second.chapter.title)).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test("maps the learner starts stay on their way across tabs, and the page shows each as it turns ready", async ({
    browser,
  }) => {
    const { first, second, user } = await createLearner();
    const page = await openAs(browser, user);
    const tabs = page.getByRole("navigation", { name: "Mind maps" });
    const tab = (name: string) => tabs.getByRole("link", { name: new RegExp(`^${name}`, "u") });
    const tabReads: string[] = [];

    // A copy of a tab from the server can predate the learner's taps, so tabs switch on the page.
    page.on("request", (request) => {
      const url = new URL(request.url());

      if (url.pathname === "/mind-maps" && url.searchParams.has("tab")) {
        tabReads.push(request.url());
      }
    });

    try {
      await page.goto("/mind-maps");
      await page.getByRole("button", { name: /^Show chapters/u }).click();

      await page
        .getByRole("listitem")
        .filter({ hasText: second.chapter.title })
        .getByRole("button", { name: "Create" })
        .click();

      await expect(page.getByText(/1 on the way/u)).toBeVisible();

      await tab("Lessons").click();
      await expect(tab("Lessons")).toHaveAttribute("aria-current", "page");
      await page.goBack();
      await expect(tab("Chapters")).toHaveAttribute("aria-current", "page");
      await expect(page.getByText(/1 on the way/u)).toBeVisible();

      await page.getByRole("button", { name: "Create 1 chapter map" }).click();
      await expect(page.getByText(/2 on the way/u)).toBeVisible();

      await tab("Lessons").click();
      await expect(tab("Lessons")).toHaveAttribute("aria-current", "page");
      await tab("Chapters").click();
      await expect(tab("Chapters")).toHaveAttribute("aria-current", "page");
      await expect(page.getByText(/2 on the way/u)).toBeVisible();

      await drawMap(first.chapter.id);

      await expect(
        page.getByRole("link", { name: new RegExp(first.chapter.title, "u") }),
      ).toBeVisible({ timeout: 15_000 });

      await expect(page.getByText(/1 on the way/u)).toBeVisible();
      expect(tabReads).toEqual([]);
    } finally {
      await page.context().close();
    }
  });

  test("the sidebar's Mind maps link keeps a map the learner just started on its way", async ({
    browser,
  }) => {
    const { second, user } = await createLearner();
    const page = await openAs(browser, user);
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });

    try {
      await page.goto("/mind-maps");
      await page.getByRole("button", { name: /^Show chapters/u }).click();

      await page
        .getByRole("listitem")
        .filter({ hasText: second.chapter.title })
        .getByRole("button", { name: "Create" })
        .click();

      await expect(page.getByText(/1 on the way/u)).toBeVisible();

      // The list read the Create started has come back, so no reply in flight can mend an older copy.
      await expect(page.getByRole("button", { name: "Create 1 chapter map" })).toBeVisible();

      await sidebar.getByRole("link", { exact: true, name: "Mind maps" }).click();
      await expect(page.getByText(/1 on the way/u)).toBeVisible();

      await drawMap(second.chapter.id);

      await expect(
        page.getByRole("link", { name: new RegExp(second.chapter.title, "u") }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await page.context().close();
    }
  });

  test("a save stored while the page mends an older copy leaves the map the learner started on its way", async ({
    browser,
  }) => {
    const { first, goal, second, user } = await createLearner();

    await Promise.all([
      drawMap(first.chapter.id),
      saveChapterMap({ chapter: first.chapter, goalId: goal.id, userId: user.id }),
    ]);

    const page = await openAs(browser, user);
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const tabs = page.getByRole("navigation", { name: "Mind maps" });
    const tab = (name: string) => tabs.getByRole("link", { name: new RegExp(`^${name}`, "u") });
    const routerCopy = Promise.withResolvers<null>();
    const answered = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();
    const delivered = Promise.withResolvers<null>();
    const reads = { count: 0 };

    try {
      await page.goto("/mind-maps");
      await page.getByRole("button", { name: /^Show chapters/u }).click();

      await page
        .getByRole("listitem")
        .filter({ hasText: second.chapter.title })
        .getByRole("button", { name: "Create" })
        .click();

      await expect(page.getByText(/1 on the way/u)).toBeVisible();

      // The list read the Create started has come back, so no reply in flight can mend an older copy.
      await expect(page.getByRole("button", { name: "Create 1 chapter map" })).toBeHidden();

      // The sidebar hands back the copy prefetched before the Create, so the page reads its list
      // again. That read is answered before the removal and arrives after it.
      await page.route(
        (url) => url.pathname.endsWith("/mind-maps"),
        async (route) => {
          const headers = route.request().headers();

          if (headers.rsc && !headers["next-router-prefetch"]) {
            await routerCopy.promise;
          }

          await route.fallback();
        },
      );

      await page.route("**/v1/goals/*/mind-maps", async (route) => {
        reads.count += 1;

        if (reads.count !== 1) {
          await route.continue();
          return;
        }

        const response = await route.fetch();
        answered.resolve(null);
        await release.promise;

        try {
          await route.fulfill({ response });
        } finally {
          delivered.resolve(null);
        }
      });

      await sidebar.getByRole("link", { exact: true, name: "Mind maps" }).click();
      await answered.promise;
      await tab("Saved").click();

      const storing = page.waitForResponse(
        (response) =>
          response.url().endsWith("/mind-maps/saved") && response.request().method() === "POST",
      );

      await page
        .getByRole("list", { name: "Saved maps" })
        .getByRole("button", { name: "Saved" })
        .click();

      const stored = await storing;
      await stored.finished();

      release.resolve(null);
      await delivered.promise;

      await tab("Chapters").click();
      await expect(page.getByText(/1 on the way/u)).toBeVisible();

      await drawMap(second.chapter.id);

      await expect(
        page.getByRole("link", { name: new RegExp(second.chapter.title, "u") }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      routerCopy.resolve(null);
      release.resolve(null);
      await page.context().close();
    }
  });

  test("a lesson's Close brings back the chapter page with the map the learner started still on its way", async ({
    browser,
  }) => {
    const { first, user } = await createLearner();
    const { chapter } = first;
    const page = await openAs(browser, user);
    const map = page.locator('[data-slot="chapter-map-aside"]');
    const release = Promise.withResolvers<null>();

    try {
      await page.goto("/plan");

      const chapterLink = page
        .getByRole("list", { name: "Your path" })
        .getByRole("link", { name: new RegExp(chapter.title, "u") });

      await expectHydrated(chapterLink);
      await chapterLink.click();
      await map.getByRole("button", { name: "Create" }).click();
      await expect(map.getByText("Drawing the mind map…")).toBeVisible();

      await page.getByRole("link", { name: /An almost empty atom/u }).click();
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      // The router shows the copy it kept from before the Create; its own fresh copy can be slow.
      await page.route(
        (url) => url.pathname.endsWith(`/content/chapters/${chapter.id}`),
        async (route) => {
          const headers = route.request().headers();

          if (headers.rsc && !headers["next-router-prefetch"]) {
            await release.promise;
          }

          await route.fallback();
        },
      );

      await page.getByRole("link", { name: "Close lesson" }).click();
      await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();
      await expect(map.getByText("Drawing the mind map…")).toBeVisible();

      await drawMap(chapter.id);

      await expect(map.getByRole("button", { name: "Full screen" })).toBeVisible({
        timeout: 15_000,
      });

      release.resolve(null);
    } finally {
      await page.context().close();
    }
  });

  test("a read of the chapter's map that arrives after the learner saved it leaves the map saved", async ({
    browser,
  }) => {
    const { first, user } = await createLearner();
    const { chapter } = first;

    await drawMap(chapter.id);

    const page = await openAs(browser, user);
    const viewer = page.getByRole("dialog", { name: chapter.title });
    const savedCount = () => prisma.savedMindMap.count({ where: { userId: user.id } });
    const routerCopy = Promise.withResolvers<null>();
    const answered = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();
    const delivered = Promise.withResolvers<null>();

    try {
      await page.goto(`/content/chapters/${chapter.id}`);

      const lesson = page.getByRole("link", { name: /An almost empty atom/u });
      await expectHydrated(lesson);
      await lesson.click();
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      await page.route(
        (url) => url.pathname.endsWith(`/content/chapters/${chapter.id}`),
        async (route) => {
          const headers = route.request().headers();

          if (headers.rsc && !headers["next-router-prefetch"]) {
            await routerCopy.promise;
          }

          await route.fallback();
        },
      );

      // Close lesson brings back the router's kept copy, so the page reads its map again. That
      // read is answered before the Save and arrives after it.
      await page.route("**/v1/goals/*/chapters/*/mind-map", async (route) => {
        const response = await route.fetch();
        answered.resolve(null);
        await release.promise;

        try {
          await route.fulfill({ response });
        } finally {
          delivered.resolve(null);
        }
      });

      await page.getByRole("link", { name: "Close lesson" }).click();
      await answered.promise;
      await page.getByRole("button", { name: "Full screen" }).click();

      const storing = page.waitForResponse(
        (response) =>
          response.url().endsWith("/mind-maps/saved") && response.request().method() === "POST",
      );

      await viewer.getByRole("button", { exact: true, name: "Save" }).click();
      const stored = await storing;
      await stored.finished();

      release.resolve(null);
      await delivered.promise;

      // Still saved, so the next press removes it rather than saving it again.
      const saved = viewer.getByRole("button", { exact: true, name: "Saved" });
      await expect(saved).toBeVisible();
      await saved.click();
      await expect.poll(savedCount).toBe(0);
    } finally {
      routerCopy.resolve(null);
      release.resolve(null);
      await page.context().close();
    }
  });

  test("a free learner out of maps for the day sees why, and no chapter offers to create one", async ({
    browser,
  }) => {
    const { first, second, user } = await createLearner();

    await Promise.all([
      drawMap(first.chapter.id),
      prisma.lesson.update({ data: { contentStatus: "pending" }, where: { id: second.lessonId } }),
      usageRecordsFixture({ count: 3, createdAt: new Date(), kind: "mindMap", userId: user.id }),
    ]);

    const page = await openAs(browser, user);
    const notMade = page.getByRole("region", { name: "Not made yet" });

    try {
      await page.goto("/mind-maps");
      await expect(notMade.getByText("No more new mind maps today")).toBeVisible();
      await expect(notMade.getByRole("link", { name: "See Plus" })).toBeVisible();

      await notMade.getByRole("button", { name: /^Show chapters/u }).click();

      const row = notMade.getByRole("listitem").filter({ hasText: second.chapter.title });
      await expect(row.getByText("1 lesson to write", { exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: "Create" })).toBeHidden();

      await expect(
        notMade.getByText("Writing lessons counts toward your free lessons."),
      ).toBeHidden();
    } finally {
      await page.context().close();
    }
  });

  test("a read of the list that comes back late doesn't undo a map started after it", async ({
    browser,
  }) => {
    const { first, second, user } = await createLearner();
    const page = await openAs(browser, user);
    const row = (title: string) => page.getByRole("listitem").filter({ hasText: title });
    const mapLink = (title: string) => page.getByRole("link", { name: new RegExp(title, "u") });
    const drawn = Promise.withResolvers<null>();
    const answered = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();
    const delivered = Promise.withResolvers<null>();
    const reads = { count: 0 };

    try {
      await page.goto("/mind-maps");
      await page.getByRole("button", { name: /^Show chapters/u }).click();

      // The page's first read of the list is answered before the second map starts, and arrives
      // only after the page has read the list again.
      await page.route("**/v1/goals/*/mind-maps", async (route) => {
        reads.count += 1;

        if (reads.count !== 1) {
          await route.continue();
          return;
        }

        await drawn.promise;
        const response = await route.fetch();
        answered.resolve(null);
        await release.promise;

        try {
          await route.fulfill({ response });
        } finally {
          delivered.resolve(null);
        }
      });

      await row(first.chapter.title).getByRole("button", { name: "Create" }).click();
      await drawMap(first.chapter.id);
      drawn.resolve(null);
      await answered.promise;

      await row(second.chapter.title).getByRole("button", { name: "Create" }).click();
      await expect(mapLink(first.chapter.title)).toBeVisible();
      await expect(page.getByText(/1 on the way/u)).toBeVisible();

      release.resolve(null);
      await delivered.promise;
      await drawMap(second.chapter.id);

      // Only a page still following the second map sees it turn ready.
      await expect(mapLink(second.chapter.title)).toBeVisible({ timeout: 15_000 });
    } finally {
      await page.context().close();
    }
  });

  test("a request that didn't reach the server says so until the page's next read comes through", async ({
    browser,
  }) => {
    const { first, second, user } = await createLearner();
    const page = await openAs(browser, user);
    const row = (title: string) => page.getByRole("listitem").filter({ hasText: title });
    const secondRow = row(second.chapter.title);
    const message = "We couldn't reach the server. Check your connection.";
    const unreachable = page.getByText(message, { exact: true }).filter({ visible: true });

    try {
      await page.goto("/mind-maps");
      await page.getByRole("button", { name: /^Show chapters/u }).click();
      await row(first.chapter.title).getByRole("button", { name: "Create" }).click();
      await expect(page.getByText(/1 on the way/u)).toBeVisible();

      // The button counts only what's left to start once the first map is on its way.
      const createRest = page.getByRole("button", { name: "Create 1 chapter map" });
      await expect(createRest).toBeVisible();

      await page.route("**/generations", (route) => route.abort());
      await secondRow.getByRole("button", { name: "Create" }).click();
      await createRest.click();

      // Both requests say so: the row's in the row, the button's under the button.
      await expect(secondRow.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(unreachable).toHaveCount(2);

      // The first map is still drawing, so the page reads the list again within a few seconds.
      await expect(unreachable).toHaveCount(0, { timeout: 15_000 });
      await expect(secondRow.getByRole("button", { name: "Create" })).toBeVisible();
    } finally {
      await page.context().close();
    }
  });
});
