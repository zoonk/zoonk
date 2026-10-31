import { type Request } from "@playwright/test";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";

/** Chromium's fake microphone records without a device or a permission prompt. */
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

const SPOKEN_ANSWERS_URL = "**/v1/steps/*/spoken-answers";

const TARGET_WORDS = ["The", "electron", "is", "a", "cloud"];

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

const NO_SPEECH = {
  json: {
    error: {
      code: "NO_SPEECH",
      message: "We couldn't hear any words. Try again, or type your answer.",
    },
  },
  status: 422,
};

async function sayIt(page: Page) {
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText("Listening… Tap Stop to check.")).toBeVisible();

  await expect(
    page.getByRole("button", { name: /^Stop\s?\d+:(?:0[1-9]|[1-5]\d)$/u }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Stop/u }).click();
}

test.describe("A spoken answer", () => {
  test("goes to the API with the learner's token, asks again when no words were heard, then shows what was heard", async ({
    browser,
    noProgressUser,
  }) => {
    const [{ lesson }, context] = await Promise.all([
      playableLessonFixture({ steps: ["spokenAnswer", "summary"] }),
      browser.newContext({
        permissions: ["microphone"],
        storageState: noProgressUser.storageState,
      }),
    ]);

    const page = await context.newPage();
    const sent: Request[] = [];

    await page.route(SPOKEN_ANSWERS_URL, async (route) => {
      sent.push(route.request());
      await route.fulfill(sent.length === 1 ? NO_SPEECH : { json: GRADE, status: 200 });
    });

    try {
      await page.goto(`/learn/${lesson.id}`);

      await sayIt(page);
      await expect(page.getByText("We couldn't hear any words. Try again.")).toBeVisible();

      await sayIt(page);
      await expect(page.getByText("What we heard")).toBeVisible();

      const [request] = sent;
      const body = request?.postData() ?? "";

      expect(sent).toHaveLength(2);
      expect(request?.headers().authorization).toMatch(/^Bearer /u);
      expect(body).toContain('name="audio"');
      expect(body).toContain('name="durationMs"');
      expect(body).toContain('name="timeZone"');
    } finally {
      await context.close();
    }
  });
});
