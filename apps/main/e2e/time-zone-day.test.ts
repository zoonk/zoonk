import { type Browser, type Page, type Request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EPersona, createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { expect, test } from "./fixtures";

/**
 * The learner's day comes from their goal's stored zone, wherever their device is: Today and the
 * session's actions read the same day. A learner who moved takes the device's zone before their
 * day starts; once they studied, the day stays the goal's until the next one.
 */

/**
 * The learner's goal lives in Honolulu and their device is in Kiritimati: 24 hours apart, neither
 * with summer time, so at any hour the device's day is the goal's next one, and both turn at the
 * same moment.
 */
const GOAL_ZONE = "Pacific/Honolulu";
const DEVICE_ZONE = "Pacific/Kiritimati";

/**
 * Room for a test to seed the learner, open Today and check it (more than its 30-second budget): no
 * midnight of the goal's may fall inside.
 */
const MIDNIGHT_MARGIN_MS = 60_000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "Fri, Oct 9": the day at `at` as Today's compact header writes it. */
function headerDay(timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone,
    weekday: "short",
  }).format(at);
}

function localDay(timeZone: string, at: Date): Date {
  return getDateInTimeZone({ date: at, timeZone });
}

/** How long after `at` the next midnight comes in `timeZone`, a zone without summer time. */
function untilMidnight(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    second: "numeric",
    timeZone,
  }).formatToParts(at);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((each) => each.type === type)?.value ?? 0);

  const sinceMidnight = ((part("hour") * 60 + part("minute")) * 60 + part("second")) * 1000;
  return MS_PER_DAY - sinceMidnight - at.getMilliseconds();
}

/**
 * The moment a test reads its days at: now, unless the goal's midnight comes before the test could
 * finish, then just after it, so the days it seeds and checks stay the ones the server reads.
 */
async function startClearOfMidnight(): Promise<Date> {
  const wait = untilMidnight(GOAL_ZONE, new Date());

  if (wait < MIDNIGHT_MARGIN_MS) {
    test.setTimeout(test.info().timeout + wait + 1000);

    await new Promise((resolve) => {
      setTimeout(resolve, wait + 1000);
    });
  }

  return new Date();
}

/**
 * A copy of the stocks persona (a small plan, so each Today read is quick) with its goal in
 * Honolulu, on a device in Kiritimati: a day ahead of the goal's.
 */
async function openLearnerElsewhere(browser: Browser) {
  const at = await startClearOfMidnight();
  const user = await createE2EPersona(getBaseURL(), { persona: "stocks", timeZone: GOAL_ZONE });

  const context = await browser.newContext({
    storageState: user.storageState,
    timezoneId: DEVICE_ZONE,
  });

  return { at, context, device: DEVICE_ZONE, page: await context.newPage(), user };
}

async function readGoalZone(user: E2EPersona) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });
  return goal.timezone;
}

/**
 * Nothing yet today in the goal's zone: no answer, no block opened or finished, the session not
 * started. Before the learner's study hour, the seed dates today's activity minutes ago, which would
 * keep the session the goal's past midnight on the device's day.
 */
async function clearToday(user: E2EPersona, at: Date) {
  const today = { goalId: user.goalId, localDate: localDay(user.timeZone, at) };

  await Promise.all([
    prisma.attempt.deleteMany({ where: { localDate: today.localDate, userId: user.id } }),
    prisma.studySessionBlock.updateMany({
      data: { completedAt: null, startedAt: null, status: "pending" },
      where: { session: today },
    }),
    prisma.studySession.updateMany({
      data: { endedAt: null, startedAt: null, status: "planned" },
      where: today,
    }),
  ]);
}

/** How long after the follow answers its effects count: Today's view read and any prefetches. */
const AFTER_FOLLOW_MS = 6000;

/** Where the browser reads Today's view again, instead of rendering the page again. */
const TODAY_VIEW_PATH = "/api/learner/views/today";

/** The follow's ask, however it's sent (a request, or a Server Action): a POST naming the zone. */
function isFollowAsk(request: Request, zone: string): boolean {
  return request.method() === "POST" && (request.postData() ?? "").includes(zone);
}

/**
 * A read of the app's pages, named by what it asked for: a page read again (`page`), or a link's
 * prefetch at its tier (`Next-Router-Prefetch`: prerendered segments, its shell, or its page) and,
 * for prerendered ones, the segment, at its address with its query (two addresses are two links).
 * Null for anything else (Main's own data, the follow).
 */
function toPageRead(request: Request, origin: string): string | null {
  const url = new URL(request.url());

  if (url.origin !== origin || request.headers().rsc !== "1") {
    return null;
  }

  const { "next-router-prefetch": tier = "page", "next-router-segment-prefetch": segment = "" } =
    request.headers();

  url.searchParams.delete("_rsc");

  return `${tier} ${url.pathname}${url.search} ${segment}`.trim();
}

/**
 * The follow's answer, then the response to Today's view read sent after it: the read the follow
 * made (`viewReads`), as against one the page sent before the answer.
 */
function watchFollow(page: Page, zone: string) {
  const answered = Promise.withResolvers<null>();
  const viewed = Promise.withResolvers<null>();
  const viewReads = new Set<Request>();
  let hasAnswered = false;

  page.on("request", (request) => {
    if (hasAnswered && new URL(request.url()).pathname === TODAY_VIEW_PATH) {
      viewReads.add(request);
    }
  });

  page.on("response", (response) => {
    if (isFollowAsk(response.request(), zone)) {
      hasAnswered = true;
      answered.resolve(null);
    } else if (viewReads.has(response.request())) {
      viewed.resolve(null);
    }
  });

  return {
    answered: answered.promise,
    hasAnswered: () => hasAnswered,
    viewReads,
    viewed: viewed.promise,
  };
}

test.describe("The learner's day on a device in another zone", () => {
  test("keeps the day of a goal studied today, and Continue opens its session", async ({
    browser,
  }) => {
    const { at, context, page, user } = await openLearnerElsewhere(browser);

    try {
      await page.goto("/today");
      await expect(page.getByText(headerDay(user.timeZone, at), { exact: true })).toBeVisible();

      const card = page.getByRole("region", { name: "Today's session" });
      await card.getByRole("button", { name: /^Continue/u }).click();
      await expect(page).toHaveURL(/\/learn\/[\w-]+\?session=[\w-]+$/u);

      await expect.poll(() => readGoalZone(user)).toBe(user.timeZone);
    } finally {
      await context.close();
    }
  });

  test("moves to the device's day while nothing was done yet today, with one ask, then reads Today once", async ({
    browser,
  }) => {
    const { at, context, device, page, user } = await openLearnerElsewhere(browser);
    await clearToday(user, at);

    const origin = new URL(getBaseURL()).origin;
    const asks: string[] = [];
    const reads: string[] = [];
    const follow = watchFollow(page, device);

    page.on("request", (request) => {
      if (isFollowAsk(request, device)) {
        asks.push(request.url());
      } else if (follow.hasAnswered()) {
        // From the follow's answer on: the page's own first prefetches may still be on their way.
        const read = toPageRead(request, origin);

        if (read) {
          reads.push(read);
        }
      }
    });

    try {
      await page.goto("/today");
      await follow.answered;

      // The day moves with the view read the follow made (the one counted), however long the server
      // takes to answer it, and the goal takes the device's zone.
      await follow.viewed;
      await expect(page.getByText(headerDay(device, at), { exact: true })).toBeVisible();
      await expect.poll(() => readGoalZone(user)).toBe(device);

      // One read of Today, its view's own (never the page rendered again), and no link in sight
      // prefetched twice.
      await page.evaluate(async (ms) => {
        await new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
      }, AFTER_FOLLOW_MS);

      const repeated = Object.entries(Object.groupBy(reads, (read) => read)).flatMap(
        ([read, times]) => ((times?.length ?? 0) > 1 ? [read] : []),
      );

      expect.soft(asks).toHaveLength(1);
      expect.soft([...follow.viewReads].map((request) => request.url())).toHaveLength(1);
      expect.soft(reads.filter((read) => read === "page /today")).toStrictEqual([]);
      expect.soft(repeated, reads.join("\n")).toStrictEqual([]);
    } finally {
      await context.close();
    }
  });
});
