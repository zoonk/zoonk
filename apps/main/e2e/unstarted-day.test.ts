import { randomUUID } from "node:crypto";
import { instant } from "@next/playwright";
import { type Browser, type Locator, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type Page, expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { expectHydrated } from "./on-demand-code";
import { logStatusLines, readStatusLog } from "./status-lines";
import { openAs } from "./study-day";
import { createUnstartedDay } from "./unstarted-day-fixtures";

type UnstartedDay = Awaited<ReturnType<typeof createUnstartedDay>>;

/** A phone, where the session screen shows its step without the day's queue beside it. */
const PHONE = { height: 844, width: 390 };

/** The wait line shows this long after the tap, never sooner. */
const SLOW_WAIT_MS = 1500;

const SKELETONS_KEY = "zoonk-e2e-skeletons";
const OPENING = "Opening your next step…";

/**
 * Records each page that painted a loading placeholder in its main region, from its first document
 * on: right before each frame is painted, the placeholders still there are checked. The record lives
 * in session storage, so a hard load keeps what the page before it showed.
 */
async function watchSkeletons(page: Page) {
  await page.addInitScript((key) => {
    let scheduled = false;

    const record = () => {
      scheduled = false;

      const shown = [...document.querySelectorAll('main [data-slot="skeleton"]')].some((skeleton) =>
        skeleton.checkVisibility(),
      );

      const address = `${location.pathname}${location.search}`;
      const painted = JSON.parse(sessionStorage.getItem(key) ?? "[]") as string[];

      if (shown && !painted.includes(address)) {
        sessionStorage.setItem(key, JSON.stringify([...painted, address]));
      }
    };

    new MutationObserver(() => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(record);
      }
    }).observe(document, {
      attributeFilter: ["class", "hidden", "style"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }, SKELETONS_KEY);
}

/**
 * No loading placeholder was painted in the page's main region since it opened. It reads the
 * record after the next frame, so whatever is on screen now has been checked.
 */
async function expectNoSkeleton(page: Page) {
  const painted = await page.evaluate(async (key) => {
    await new Promise(requestAnimationFrame);
    return JSON.parse(sessionStorage.getItem(key) ?? "[]") as string[];
  }, SKELETONS_KEY);

  expect(painted, "pages that painted a skeleton").toStrictEqual([]);
}

/** A phone four times slower than the test machine, as a learner's cheaper phone is. */
async function throttleCpu(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

/** The cookie `instant()` sets while it holds the page to what was prefetched. */
const INSTANT_COOKIE = "next-instant-navigation-testing";

/**
 * Sends a held request on without the instant-testing cookie, and hands its answer to the page.
 * The browser fixed the request's cookies when the page sent it, and Playwright can't override a
 * `Cookie` header on continue, so the test sends it itself with the cookies it had, less that one.
 * It doesn't wait for the answer: a test may be holding what the request waits on.
 */
async function sendWithoutInstantCookie(route: Route) {
  const headers = await route.request().allHeaders();

  const cookie = (headers.cookie ?? "")
    .split(/;\s*/u)
    .filter((pair) => pair.length > 0 && !pair.startsWith(`${INSTANT_COOKIE}=`))
    .join("; ");

  const send = async () => {
    const response = await route.fetch({ headers: { ...route.request().headers(), cookie } });
    await route.fulfill({ response });
  };

  // The page closing first ends the request with it.
  void send().catch(() => null);
}

/**
 * Holds the learner's opens of the day until the test lets each one go: Server Action POSTs whose
 * arguments name the day the learner was shown, or any id the test adds to `ids` (a saved day's
 * actions name its session or block instead). Every other request goes through.
 *
 * Let an open go only after an `instant()` scope ends: Next 16.4 answers a Server Action that
 * carries the instant-testing cookie with the page's static shell instead of running it (it takes
 * every request without an `RSC` header for a document load). An open tapped inside the scope was
 * sent with that cookie, so it goes on without it (`sendWithoutInstantCookie`).
 */
async function holdOpens(page: Page) {
  const ids = new Set<string>();
  const bodies: string[] = [];
  const held: Route[] = [];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const body = request.postData() ?? "";

    const opens =
      request.method() === "POST" &&
      Boolean(request.headers()["next-action"]) &&
      (body.includes('"shownDate"') || [...ids].some((id) => body.includes(id)));

    if (!opens) {
      await route.fallback();
      return;
    }

    bodies.push(body);
    held.push(route);
  });

  /** The next open the page sent, still waiting for the test. */
  const take = async () => {
    await expect.poll(() => held.length, { message: "the page sends an open" }).toBeGreaterThan(0);
    return held.shift()!;
  };

  return {
    bodies,
    ids,
    /** The next held open, which the test fails or lets go. */
    next: async () => {
      const route = await take();

      return {
        abort: (errorCode: string) => route.abort(errorCode),
        continue: () => sendWithoutInstantCookie(route),
      };
    },
    /** Lets the next open through, once its answer reached the page. */
    release: async () => {
      const route = await take();
      await sendWithoutInstantCookie(route);
      await route.request().response();
    },
  };
}

type HeldOpens = Awaited<ReturnType<typeof holdOpens>>;

/** Runs a test as a fresh learner whose day isn't opened, its page watched for placeholders. */
async function asUnstartedDay(
  browser: Browser,
  { cpu = false, phone = false }: { cpu?: boolean; phone?: boolean },
  run: (session: { day: UnstartedDay; opens: HeldOpens; page: Page }) => Promise<void>,
) {
  const day = await createUnstartedDay();
  const page = await openAs(browser, day.user);

  try {
    if (phone) {
      await page.setViewportSize(PHONE);
    }

    if (cpu) {
      await throttleCpu(page);
    }

    await watchSkeletons(page);
    const opens = await holdOpens(page);
    await run({ day, opens, page });
    await expectNoSkeleton(page);
  } finally {
    await page.context().close();
  }
}

function todaySession(page: Page) {
  return page.getByRole("region", { name: "Today's session" });
}

/** Today's steps as the learner reads them: each one's title (its first line) and minutes (its last). */
async function readTodaySteps(page: Page) {
  const rows = todaySession(page).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  const texts = await rows.allInnerTexts();

  return texts.map((text) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return { minutes: lines.at(-1) ?? "", title: lines[0] ?? "" };
  });
}

/**
 * Today, read and settled: its prefetches have landed, so a tap can paint from them. On a slow
 * phone the network can go quiet before the page runs its own code, so it waits for the session
 * screen's page itself.
 */
async function openToday(page: Page) {
  const sessionFrame = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/session" &&
      (response.request().headers()["next-router-segment-prefetch"] ?? "").endsWith("/__PAGE__"),
  );

  await page.goto("/today");
  await expect(page.getByRole("button", { name: "Start session" })).toBeEnabled();
  await sessionFrame;
  await page.waitForLoadState("networkidle");
}

/** The step a tap from Today shows in the session's frame before any server reply. */
async function expectOpeningStep(page: Page, title: string) {
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Today's session" })).toBeVisible();
  await expect(main.getByText("Up next", { exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { exact: true, level: 2, name: title })).toBeVisible();
}

/** A step's main action while its open is under way: busy and refused, yet still focusable. */
async function expectBusy(action: Locator) {
  await expect(action).toHaveAttribute("aria-busy", "true");
  await expect(action).toHaveAttribute("aria-disabled", "true");
  await expect(action).not.toHaveAttribute("disabled");
}

function countSessions(userId: string) {
  return prisma.studySession.count({ where: { userId } });
}

/** The learner's one saved day: its blocks by position, as kind, lesson and status. */
async function readSavedDay(userId: string) {
  await expect.poll(() => countSessions(userId)).toBe(1);

  const session = await prisma.studySession.findFirstOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { userId },
  });

  return {
    blocks: session.blocks.map((block) => ({
      id: block.id,
      kind: block.kind,
      lessonId: block.lessonId,
      status: block.status,
    })),
    id: session.id,
  };
}

async function readBlockStatus(blockId = "") {
  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
  return block.status;
}

/** The work Today previewed, in its order: the review, the two lessons left, then practice. */
function previewedWork(day: UnstartedDay) {
  return [
    { kind: "review", lessonId: null },
    { kind: "learn", lessonId: day.lessons[1]?.id },
    { kind: "learn", lessonId: day.lessons[2]?.id },
    { kind: "practice", lessonId: null },
  ];
}

/** Every address the page shows from now on, client navigations included. */
function trackAddresses(page: Page) {
  const paths: string[] = [];

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      paths.push(new URL(frame.url()).pathname);
    }
  });

  return paths;
}

/**
 * Holds the server's replies to the navigation into a day's session screen (not prefetches), so the
 * frame drawn from the tap stays until the test lets them in. A navigation inside an `instant()`
 * scope reads the screen once during it and again after it, so every read is held until `release`.
 */
async function holdSessionEntry(page: Page, goalId: string) {
  const reading = Promise.withResolvers<null>();
  const held: Route[] = [];
  let released = false;

  await page.route(
    (url) => url.pathname === "/session" && url.searchParams.get("goal") === goalId,
    async (route) => {
      const request = route.request();
      const headers = request.headers();

      if (
        released ||
        request.method() !== "GET" ||
        headers.rsc !== "1" ||
        headers["next-router-prefetch"]
      ) {
        await route.fallback();
        return;
      }

      held.push(route);
      reading.resolve(null);
    },
  );

  return {
    /** Lets the screen's content in: every read held so far, and any after. */
    release: async () => {
      await reading.promise;
      released = true;
      await Promise.all(held.splice(0).map((route) => route.continue()));
    },
  };
}

/** The session screen of a day not opened yet, by the goal it's for. */
function isSessionFor(goalId: string) {
  return (url: URL) => url.pathname === "/session" && url.search === `?goal=${goalId}`;
}

test.describe("An unstarted day", () => {
  test("Start shows the review at once on a slow phone, then opens it in place", async ({
    browser,
  }) => {
    await asUnstartedDay(browser, { cpu: true, phone: true }, async ({ day, opens, page }) => {
      const entry = await holdSessionEntry(page, day.goal.id);
      await openToday(page);
      const [review] = await readTodaySteps(page);
      const addresses = trackAddresses(page);
      const main = page.getByRole("main");
      const start = main.getByRole("button", { exact: true, name: "Start" });

      await instant(page, async () => {
        await page.getByRole("button", { name: "Start session" }).click();
        await expect(page).toHaveURL(isSessionFor(day.goal.id));
        await expectOpeningStep(page, review?.title ?? "");

        await expect(
          main.getByText(review?.minutes ?? "", { exact: true }).filter({ visible: true }),
        ).toBeVisible();

        await expect(main.getByRole("progressbar", { name: "0 of 4 done" })).toBeVisible();
        await expectBusy(start);
        await start.focus();
        await expect(start).toBeFocused();
        await expect(countSessions(day.user.id)).resolves.toBe(0);
        await expectNoSkeleton(page);
      });

      // The open answers before the screen's own content arrives: the step stays busy, and the
      // content takes the answer as it comes in.
      await opens.release();
      await expectBusy(start);
      await entry.release();

      await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();

      const saved = await readSavedDay(day.user.id);
      expect(saved.blocks).toMatchObject(previewedWork(day));
      await expect.poll(() => readBlockStatus(saved.blocks[0]?.id)).toBe("active");
      expect(addresses).not.toContain("/today");
      expect(opens.bodies).toHaveLength(1);
    });
  });

  test("a row further down opens that step, not the day's first", async ({ browser }) => {
    await asUnstartedDay(browser, { cpu: true }, async ({ day, opens, page }) => {
      await openToday(page);

      await instant(page, async () => {
        await todaySession(page)
          .getByRole("button", { name: /^Practice mistakes/u })
          .click();

        await expect(page).toHaveURL(isSessionFor(day.goal.id));
        await expectOpeningStep(page, "Practice mistakes");

        await expect(
          page.getByRole("main").getByRole("heading", { level: 2, name: /review/iu }),
        ).toHaveCount(0);

        await expectNoSkeleton(page);
      });

      await opens.release();

      await expect(
        page.getByRole("heading", { level: 1, name: "Practice mistakes" }),
      ).toBeVisible();

      await expect(page.getByRole("heading", { name: day.question })).toBeVisible();

      const saved = await readSavedDay(day.user.id);
      expect(saved.blocks).toMatchObject(previewedWork(day));

      await expect
        .poll(() => Promise.all(saved.blocks.map((block) => readBlockStatus(block.id))))
        .toStrictEqual(["pending", "pending", "pending", "active"]);
    });
  });

  test("Today previews the day without saving it, and the day it opens is the day Today showed", async ({
    browser,
  }) => {
    await asUnstartedDay(browser, {}, async ({ day, opens, page }) => {
      const sessionRequests: (string | undefined)[] = [];

      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/session") {
          sessionRequests.push(request.headers()["next-router-prefetch"]);
        }
      });

      await openToday(page);

      await expect(todaySession(page).getByRole("listitem")).toHaveText(
        [
          /^(?:Quick review|Reviews)\s+\d+\smin$/u,
          new RegExp(`^${day.lessons[1]?.title}\\s+\\d+\\smin$`, "u"),
          new RegExp(`^${day.lessons[2]?.title}\\s+\\d+\\smin$`, "u"),
          /^Practice mistakes\s+\d+\smin$/u,
        ],
        { useInnerText: true },
      );

      await expect(
        todaySession(page).getByRole("img", { exact: true, name: "0 of 4 done" }),
      ).toBeVisible();

      await expect(countSessions(day.user.id)).resolves.toBe(0);

      // The session screen's static shell only ("1", or "3" for a runtime shell): a link's own
      // prefetch ("2", or none for a full one) would read the unopened day a second time.
      expect(sessionRequests, "Today prefetches the session screen's shell").not.toHaveLength(0);
      expect(sessionRequests.filter((kind) => kind !== "1" && kind !== "3")).toStrictEqual([]);

      // Start opens that day, and Today goes on with it.
      const shown = await readTodaySteps(page);

      await page.getByRole("button", { name: "Start session" }).click();
      await opens.release();
      await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();

      await page.getByRole("link", { name: "Close. Your answers are saved." }).click();
      await expect(page).toHaveURL(/\/today$/u);

      await expect(page.getByRole("button", { name: "Continue session" })).toBeVisible();
      await expect.poll(() => readTodaySteps(page)).toStrictEqual(shown);
      await expect(countSessions(day.user.id)).resolves.toBe(1);
    });
  });

  test("Enter keeps the focus and one wait line through the whole open", async ({ browser }) => {
    await asUnstartedDay(browser, { cpu: true }, async ({ day, opens, page }) => {
      await logStatusLines(page);
      const entry = await holdSessionEntry(page, day.goal.id);
      await openToday(page);
      const [review] = await readTodaySteps(page);

      await page.getByRole("button", { name: "Start session" }).focus();
      await page.keyboard.press("Enter");
      const held = await opens.next();
      await expect(page).toHaveURL(isSessionFor(day.goal.id));

      const main = page.getByRole("main");
      const start = main.getByRole("button", { exact: true, name: "Start" });
      const step = main.getByRole("heading", { exact: true, level: 2, name: review?.title ?? "" });
      await expect(start).toBeFocused();
      await expect(main.getByRole("status").filter({ hasText: OPENING })).toBeVisible();

      // The step drawn from the tap, marked, so the server's own entry taking its place shows.
      await step.evaluate((heading) => {
        heading.dataset.held = "";
      });

      await entry.release();
      await expect(step).not.toHaveAttribute("data-held");
      await expect(main.getByRole("status").filter({ hasText: OPENING })).toBeVisible();
      await expect(start).toBeFocused();

      const releasedAt = await page.evaluate(() => performance.now());
      await held.continue();

      await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();

      const { enterAt, lines } = await readStatusLog(page);
      const waiting = lines.filter((line) => line.at < releasedAt);
      const shown = waiting.findIndex((line) => line.text === OPENING);

      expect(shown, "the wait line shows while the open is held").toBeGreaterThanOrEqual(0);
      expect((waiting[shown]?.at ?? 0) - enterAt).toBeGreaterThanOrEqual(SLOW_WAIT_MS);

      // From its first showing until the release, the line never went away and started over.
      expect(waiting.slice(shown).map((line) => line.text)).toStrictEqual(
        waiting.slice(shown).map(() => OPENING),
      );
    });
  });

  test("an open that fails says so on the session screen, and Start tries again", async ({
    browser,
  }) => {
    await asUnstartedDay(browser, {}, async ({ day, opens, page }) => {
      await openToday(page);
      await page.getByRole("button", { name: "Start session" }).click();
      const failing = await opens.next();
      await failing.abort("internetdisconnected");

      await expect(page).toHaveURL(isSessionFor(day.goal.id));

      await expect(page.getByRole("main").getByRole("alert")).toHaveText(
        "We couldn't open this step. Try again.",
      );

      const start = page.getByRole("main").getByRole("button", { exact: true, name: "Start" });
      await expect(start).toBeEnabled();
      await expect(countSessions(day.user.id)).resolves.toBe(0);

      await start.click();
      await opens.release();

      await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();
      await expect(countSessions(day.user.id)).resolves.toBe(1);
    });
  });

  test("a goal paused while the open is on its way saves nothing and Today says it's paused", async ({
    browser,
  }) => {
    await asUnstartedDay(browser, {}, async ({ day, opens, page }) => {
      await openToday(page);
      await page.getByRole("button", { name: "Start session" }).click();
      const held = await opens.next();

      await prisma.goal.update({ data: { status: "paused" }, where: { id: day.goal.id } });
      await held.continue();

      await expect(page).toHaveURL(/\/today$/u);
      await expect(page.getByText(`${day.goal.title} is paused.`)).toBeVisible();
      await expect(page.getByText("Nothing is planned until you resume it.")).toBeVisible();
      await expect(countSessions(day.user.id)).resolves.toBe(0);
    });
  });

  test("a hard load of Today paints its frame without a placeholder", async ({ browser }) => {
    await asUnstartedDay(browser, {}, async ({ page }) => {
      await instant(
        page,
        async () => {
          await page.goto("/today");

          await expect(
            page.getByRole("main").getByRole("heading", { exact: true, level: 1, name: "Today" }),
          ).toBeVisible();

          await expectNoSkeleton(page);
        },
        { baseURL: getBaseURL() },
      );

      await expect(todaySession(page).getByRole("listitem")).toHaveCount(4);
    });
  });

  test("a direct load of the session screen saves nothing until Start opens the day", async ({
    browser,
  }) => {
    await asUnstartedDay(browser, { cpu: true }, async ({ day, opens, page }) => {
      await instant(
        page,
        async () => {
          await page.goto("/session");
          const main = page.getByRole("main");

          await expect(
            main.getByRole("heading", { level: 1, name: "Today's session" }),
          ).toBeVisible();

          await expect(main.getByRole("link", { name: "Back to Today" })).toBeVisible();
          await expect(main.getByText("Up next", { exact: true })).toHaveCount(0);
          await expectNoSkeleton(page);
        },
        { baseURL: getBaseURL() },
      );

      const main = page.getByRole("main");
      const start = main.getByRole("button", { exact: true, name: "Start" });

      await expect(main.getByText("Up next", { exact: true })).toBeVisible();

      await expect(
        main.getByRole("heading", { level: 2, name: /^(?:Quick review|Reviews)$/u }),
      ).toBeVisible();

      // Shown, the screen opens nothing: the learner's Start opens the day, as Today's does.
      await expectHydrated(start);
      expect(opens.bodies, "no open while the step is only shown").toStrictEqual([]);

      await start.click();
      await opens.release();

      await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();
      await expect(countSessions(day.user.id)).resolves.toBe(1);
      expect(opens.bodies).toHaveLength(1);
      expect(opens.bodies[0]).toMatch(/"target":\{/u);
    });
  });

  test("a lesson written while the session screen waits opens the day with it", async ({
    browser,
  }) => {
    const day = await createUnstartedDay();
    const lesson = day.lessons[1];
    const runId = `e2e-unstarted-lesson-${randomUUID()}`;

    // Nothing is due for review, so the day's first step is the second lesson, being written.
    await Promise.all([
      prisma.learnerSkill.updateMany({
        data: { due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        where: { userId: day.user.id },
      }),
      prisma.lesson.update({
        data: { contentRunId: runId, contentStatus: "running" },
        where: { id: lesson?.id },
      }),
    ]);

    const page = await openAs(browser, day.user);

    try {
      const opens = await holdOpens(page);

      const events: StreamEvent[] = [
        { entityId: lesson?.id, status: "started", step: "planLesson" },
        { entityId: lesson?.id, status: "completed", step: "planLesson" },
        { entityId: lesson?.id, status: "started", step: "writeLesson" },
      ];

      await followRun({ events, page, runId });
      await page.goto("/session");

      await expect(
        page.getByRole("main").getByRole("heading", { level: 2, name: lesson?.title ?? "" }),
      ).toBeVisible();

      await expect(page.getByRole("progressbar", { name: "Writing your lesson" })).toBeVisible();
      expect(opens.bodies, "no open while the lesson is written").toStrictEqual([]);

      // The run says it's ready: the screen opens the day with that lesson, and plays it.
      await prisma.lesson.update({
        data: { contentStatus: "completed" },
        where: { id: lesson?.id },
      });

      events.push({ entityId: lesson?.id, status: "completed", step: "lessonReady" });
      await opens.release();

      await expect(page).toHaveURL(new RegExp(`/learn/${lesson?.id}\\?session=`, "u"));
      await expect(countSessions(day.user.id)).resolves.toBe(1);
      expect(opens.bodies).toHaveLength(1);
      expect(opens.bodies[0]).toMatch(/"target":\{/u);
    } finally {
      await page.context().close();
    }
  });

  test("a saved day's Continue shows its step at once, then its question", async ({ browser }) => {
    await asUnstartedDay(browser, { cpu: true }, async ({ day, opens, page }) => {
      await openToday(page);
      const [review] = await readTodaySteps(page);

      await page.getByRole("button", { name: "Start session" }).click();
      await opens.release();
      await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();

      const saved = await readSavedDay(day.user.id);
      const block = saved.blocks[0]?.id ?? "";

      await page.getByRole("link", { name: "Close. Your answers are saved." }).click();
      await expect(page.getByRole("button", { name: "Continue session" })).toBeEnabled();
      await page.waitForLoadState("networkidle");
      opens.ids.add(saved.id).add(block);

      await instant(page, async () => {
        await page.getByRole("button", { name: "Continue session" }).click();

        await expect(page).toHaveURL(
          (url) => url.pathname === "/session" && url.search === `?block=${block}`,
        );

        await expectOpeningStep(page, review?.title ?? "");

        await expect(
          page.getByRole("main").getByRole("progressbar", { name: "0 of 4 done" }),
        ).toBeVisible();

        await expectBusy(
          page.getByRole("main").getByRole("button", { exact: true, name: "Continue" }),
        );

        await expectNoSkeleton(page);
      });

      await opens.release();

      await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();
      await expect(countSessions(day.user.id)).resolves.toBe(1);
    });
  });

  test("an open that loses to a plan change retries once on its own", async ({ browser }) => {
    await asUnstartedDay(browser, {}, async ({ day, opens, page }) => {
      await openToday(page);
      await page.getByRole("button", { name: "Start session" }).click();
      const first = await opens.next();

      // The open saves the day after taking the learner's plan rows; holding them lets the plan
      // change underneath it, the way a planning run elsewhere would.
      const release = Promise.withResolvers<null>();
      const ready = Promise.withResolvers<number>();

      const holding = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM plans WHERE goal_id = ${day.goal.id}::uuid FOR UPDATE`;

          const [connection] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;

          ready.resolve(connection?.pid ?? 0);
          await release.promise;

          await tx.$executeRaw`
            UPDATE plans SET input_version = input_version + 1 WHERE goal_id = ${day.goal.id}::uuid
          `;
        },
        { timeout: 20_000 },
      );

      const held = Promise.allSettled([holding]);
      void holding.catch(ready.reject);
      const pid = await ready.promise;

      try {
        await first.continue();

        await expect
          .poll(
            async () =>
              prisma.$queryRaw<{ pid: number }[]>`
                SELECT pid FROM pg_stat_activity
                WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
                  AND query ~* 'plans.*FOR UPDATE'
              `,
            { message: "the open waits for the plan rows", timeout: 10_000 },
          )
          .not.toHaveLength(0);
      } finally {
        release.resolve(null);
        await held;
      }

      await expect(held).resolves.toMatchObject([{ status: "fulfilled" }]);

      // The lost open saved nothing; the page asks again by itself, for the same tap.
      const retry = await opens.next();
      await expect(countSessions(day.user.id)).resolves.toBe(0);
      expect(opens.bodies[1]).toBe(opens.bodies[0]);
      await retry.continue();

      await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();
      await expect(countSessions(day.user.id)).resolves.toBe(1);
      await page.waitForLoadState("networkidle");
      expect(opens.bodies).toHaveLength(2);
    });
  });
});
