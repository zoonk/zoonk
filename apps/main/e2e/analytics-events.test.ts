import { randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { answerRight, createStudyDay, openAs } from "./study-day";

/**
 * Key browser events carry the mode the learner sees, in Focus and in Fun. E2E builds have no
 * PostHog settings, so the browser SDK never starts there and nothing reaches PostHog. This spec
 * hands the page settings through `process.env`, where Next reads public variables the build
 * didn't inline, and answers the SDK's requests itself, keeping the events it would have sent:
 * the Vercel queue would show that events fire, but only PostHog's copy carries `mode`.
 */

const POSTHOG_HOST = "https://posthog.e2e.test";
/** The first byte of every gzip stream. */
const GZIP_MAGIC = 31;

type SentEvent = { event: string; properties: Record<string, unknown> };

/** Sent from the server (covered by core's tests), so the browser must never send them too. */
const SERVER_OUTCOMES = new Set(["Block Completed", "Session Completed", "Session Started"]);

function readBody(body: Buffer): unknown {
  if (body[0] === GZIP_MAGIC) {
    return JSON.parse(gunzipSync(body).toString("utf8"));
  }

  const text = body.toString("utf8");

  return text.startsWith("data=")
    ? JSON.parse(Buffer.from(decodeURIComponent(text.slice("data=".length)), "base64").toString())
    : JSON.parse(text);
}

function toEvents(payload: unknown): SentEvent[] {
  const list = Array.isArray(payload) ? payload : [payload];

  return list.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    if ("batch" in item) {
      return toEvents(item.batch);
    }

    return "event" in item && "properties" in item ? [item as SentEvent] : [];
  });
}

/** Starts PostHog in the page with test settings and collects every event it sends. */
async function capturePostHog(page: Page): Promise<SentEvent[]> {
  const sent: SentEvent[] = [];

  await page.addInitScript((host) => {
    // PostHog drops events from automated browsers, so the page looks like a person's browser.
    const userAgent = navigator.userAgent.replace("HeadlessChrome", "Chrome");
    Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
    Object.defineProperty(Navigator.prototype, "userAgent", { get: () => userAgent });
    Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => null });

    // The same shape as the browser `process` polyfill Next ships, plus the PostHog settings.
    Object.assign(globalThis, {
      process: {
        argv: [],
        browser: true,
        cwd: () => "/",
        emit: () => null,
        env: { NEXT_PUBLIC_POSTHOG_HOST: host, NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_e2e" },
        listeners: () => [],
        nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
          queueMicrotask(() => callback(...args)),
        off: () => null,
        on: () => null,
        once: () => null,
        removeListener: () => null,
        title: "browser",
        version: "",
        versions: {},
      },
    });
  }, POSTHOG_HOST);

  await page.route(`${POSTHOG_HOST}/**`, async (route) => {
    const body = route.request().postDataBuffer();

    if (body && body.length > 0) {
      sent.push(...toEvents(readBody(body)));
    }

    await route.fulfill({ body: "{}", contentType: "application/json", status: 200 });
  });

  return sent;
}

async function expectSent(
  sent: SentEvent[],
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  await expect
    .poll(() => sent.filter((item) => item.event === event), { timeout: 15_000 })
    .toContainEqual(expect.objectContaining({ properties: expect.objectContaining(properties) }));
}

test.describe("Analytics", () => {
  test("Today and the session's capsules carry Focus; outcomes stay on the server", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const page = await openAs(browser, user);
    const sent = await capturePostHog(page);

    await page.goto("/today");
    await expectSent(sent, "Today Viewed", { mode: "focus" });

    await page.getByRole("button", { name: /^Start/u }).click();
    await answerRight(page, /^Capsule one/u);
    await answerRight(page, /^Capsule two/u);

    await expectSent(sent, "Capsule Opened", { mode: "focus" });

    // The block's moment shows once the block was saved, when the server sends its outcomes.
    await expect(
      page.getByRole("progressbar", { name: "Today's session: 1 of 3 done" }),
    ).toBeVisible();

    const outcomes = sent.filter((item) => SERVER_OUTCOMES.has(item.event));
    expect(outcomes).toStrictEqual([]);

    await page.context().close();
  });
});

test("switching to Fun sends Mode Switched, and later events, the player's among them, carry Fun", async ({
  browser,
}) => {
  const [{ user }, { lesson }] = await Promise.all([
    createStudyDay({ mode: "focus" }),
    playableLessonFixture({ steps: ["hook", "check", "explanation"] }),
  ]);

  const page = await openAs(browser, user);
  const sent = await capturePostHog(page);

  await page.goto("/settings/appearance");
  await page.getByRole("radio", { name: /^Fun/u }).click();
  await expectSent(sent, "Mode Switched", { from_mode: "focus", to_mode: "fun" });

  await page.goto("/today");
  await expectSent(sent, "Today Viewed", { mode: "fun" });

  // Page views carry only the registered shared properties, so they show the switch reached them.
  await expectSent(sent, "$pageview", { $pathname: "/today", mode: "fun" });

  // The player's hook, and leaving mid-lesson after a wrong answer.
  await page.goto(`/learn/${lesson.id}`);

  await page.getByRole("radio", { name: "No" }).click();
  await page.getByRole("button", { name: /^See the answer/u }).click();
  await expectSent(sent, "Hook Answered", { lesson_id: lesson.id, mode: "fun" });
  await page.getByRole("button", { name: /^Continue/u }).click();

  await page.getByRole("radio", { name: "The electron's exact path" }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect(page.getByRole("status").filter({ hasText: /\S/u })).toBeVisible();
  await page.getByRole("link", { name: "Close lesson" }).click();

  await expectSent(sent, "Activity Abandoned", {
    lesson_id: lesson.id,
    mode: "fun",
    screen: 2,
    step_kind: "check",
    wrong_in_a_row: 1,
  });

  await page.context().close();
});

test("a goal sent from the home page counts once as typed, then as classified on /start", async ({
  page,
}) => {
  const goal = `understand quantum physics for analytics ${randomUUID().slice(0, 8)}`;

  await goalUnderstandingFixture({
    goal,
    result: {
      followUps: [],
      goals: [{ kind: "learn", subject: "quantum physics", title: "Understand quantum physics" }],
      route: "goals",
    },
  });

  const sent = await capturePostHog(page);
  await page.goto("/");

  const goalBox = page.getByRole("region", { name: /Get ready for/u }).getByRole("textbox");
  await goalBox.fill(goal);
  await goalBox.press("Enter");

  await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();
  await expectSent(sent, "Goal Typed", { has_attachment: false });
  await expectSent(sent, "Goal Classified", { result: "learn" });

  const classified = sent.filter((item) => item.event === "Goal Classified");
  expect(classified).toHaveLength(1);
  expect(classified[0]?.properties.duration_ms).toEqual(expect.any(Number));

  // A refresh shows the same card without counting the goal again: once the reloaded page has
  // reported its view, there's still one "Goal Classified".
  const pageViews = () => sent.filter((item) => item.event === "$pageview").length;
  const viewsBefore = pageViews();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();
  await expect.poll(pageViews, { timeout: 15_000 }).toBeGreaterThan(viewsBefore);
  expect(sent.filter((item) => item.event === "Goal Classified")).toHaveLength(1);
});
