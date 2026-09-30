import { type Browser, type Request } from "@playwright/test";
import { getDailySpendBudgetMicros } from "@zoonk/core/entitlements/limits";
import { type E2EUser } from "@zoonk/e2e/fixtures/users";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { type Mode, expectMode, showInMode } from "./learn-personas";

/** Chromium's fake microphone, so recording starts without a device or a permission prompt. */
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

/**
 * Spoken answers go to the public API from the browser. Main's E2E runs without the API, so these
 * stand in for its answers (the API's own suite covers the endpoint, its limits included).
 */
const SPOKEN_ANSWERS_URL = "**/v1/steps/*/spoken-answers";

const TARGET_WORDS = ["The", "electron", "is", "a", "cloud"];

/** The grade of "The electron is a crowd": one word came out as another. */
const GRADE = {
  attemptId: crypto.randomUUID(),
  explanation: null,
  isCorrect: false,
  score: 0.8,
  transcript: "The electron is a crowd",
  words: TARGET_WORDS.map((text) =>
    text === "cloud"
      ? { heard: "crowd", status: "different", text }
      : { heard: null, status: "correct", text },
  ),
  wordsToPractice: [],
};

function usageLimitError(tier: "free" | "guest") {
  return {
    error: {
      code: "USAGE_LIMIT_REACHED",
      details: {
        limit: {
          limit: tier === "guest" ? 40 : getDailySpendBudgetMicros("free"),
          period: "day",
          resource: tier === "guest" ? "assist" : "aiSpend",
          tier,
        },
      },
      message: "This plan's limit is reached",
    },
  };
}

const NO_SPEECH_ERROR = {
  error: {
    code: "NO_SPEECH",
    message: "We couldn't hear any words. Try again, or type your answer.",
  },
};

/** Answers every recording with `status` and `json`, and keeps the requests the browser sent. */
async function answerRecordings(page: Page, answer: { json: object; status: number }) {
  const sent: Request[] = [];

  await page.route(SPOKEN_ANSWERS_URL, async (route) => {
    sent.push(route.request());
    await route.fulfill(answer);
  });

  return sent;
}

/** A learner in `mode` on a lesson with a "say it out loud" screen, allowed to record. */
async function openSpokenLesson({
  browser,
  mode,
  user,
}: {
  browser: Browser;
  mode: Mode;
  user: E2EUser;
}) {
  const [{ lesson }, context] = await Promise.all([
    playableLessonFixture({ steps: ["spokenAnswer", "summary"] }),
    browser.newContext({ permissions: ["microphone"], storageState: user.storageState }),
  ]);

  await showInMode(context, { mode, userId: user.id });
  const page = await context.newPage();

  return { context, lesson, page };
}

async function sayIt(page: Page) {
  await page.getByRole("button", { name: "Start speaking" }).click();
  await expect(page.getByText(/Listening… [1-9]\d*s/u)).toBeVisible();
  await page.getByRole("button", { name: "Stop and check" }).click();
}

test("a spoken answer records from the microphone once the learner allows it", async ({
  browser,
  noProgressUser,
}) => {
  const [{ lesson }, context] = await Promise.all([
    playableLessonFixture({ steps: ["spokenAnswer", "summary"] }),
    browser.newContext({ permissions: ["microphone"], storageState: noProgressUser.storageState }),
  ]);

  const page = await context.newPage();

  try {
    await page.goto(`/learn/${lesson.id}`);
    await page.getByRole("button", { name: "Start speaking" }).click();

    await expect(page.getByRole("button", { name: "Stop and check" })).toBeVisible();
    await expect(page.getByText("The microphone is blocked", { exact: false })).toBeHidden();
  } finally {
    await context.close();
  }
});

test.describe("A spoken answer", () => {
  test("goes to the API with the learner's token and shows what was heard", async ({
    browser,
    noProgressUser,
  }) => {
    const { context, lesson, page } = await openSpokenLesson({
      browser,
      mode: "focus",
      user: noProgressUser,
    });

    try {
      const sent = await answerRecordings(page, { json: GRADE, status: 200 });
      await page.goto(`/learn/${lesson.id}`);
      await expectMode(page, "focus");
      await sayIt(page);

      await expect(page.getByText("What we heard")).toBeVisible();

      // The recording and the fields the API reads, as the learner: never the step in the body.
      const [request] = sent;
      const body = request?.postData() ?? "";

      expect(request?.headers().authorization).toMatch(/^Bearer /u);
      expect(body).toContain('name="audio"');
      expect(body).toContain('name="durationMs"');
      expect(body).toContain('name="timeZone"');
      expect(body).not.toContain('name="stepId"');
    } finally {
      await context.close();
    }
  });

  test("with no words in it says so and lets the learner try again or type", async ({
    browser,
    noProgressUser,
  }) => {
    const { context, lesson, page } = await openSpokenLesson({
      browser,
      mode: "fun",
      user: noProgressUser,
    });

    try {
      const sent = await answerRecordings(page, { json: NO_SPEECH_ERROR, status: 422 });
      await page.goto(`/learn/${lesson.id}`);
      await expectMode(page, "fun");
      await sayIt(page);

      await expect(page.getByText("We couldn't hear any words. Try again.")).toBeVisible();

      const failure = page.getByText("We couldn't check your answer", { exact: false });
      await expect(failure).toBeHidden();
      await expect(page.getByRole("button", { name: "Type it instead" })).toBeVisible();

      // Trying again records and sends again.
      await sayIt(page);
      await expect.poll(() => sent.length).toBe(2);
    } finally {
      await context.close();
    }
  });

  for (const tier of ["guest", "free"] as const) {
    test(`says how a ${tier} learner keeps going once today's help is used up`, async ({
      browser,
      noProgressUser,
    }) => {
      const { context, lesson, page } = await openSpokenLesson({
        browser,
        mode: "focus",
        user: noProgressUser,
      });

      try {
        await answerRecordings(page, {
          json: usageLimitError(tier),
          status: tier === "guest" ? 403 : 402,
        });

        await page.goto(`/learn/${lesson.id}`);
        await expectMode(page, "focus");
        await sayIt(page);

        await expect(
          page.getByText(
            tier === "guest"
              ? "You've used today's free help. Create a free account to keep going."
              : "You've used today's help. It comes back tomorrow, or get Plus to keep going now.",
          ),
        ).toBeVisible();

        await expect(
          page.getByRole("link", { name: tier === "guest" ? "Create a free account" : "See Plus" }),
        ).toBeVisible();

        await expect(page.getByRole("button", { name: "Type it instead" })).toBeVisible();
      } finally {
        await context.close();
      }
    });
  }
});
