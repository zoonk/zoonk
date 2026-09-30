import { ACCESSIBILITY_VIEWPORTS, scanCurrentScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { MODES } from "./learn-personas";
import { answerRight, continueWithEnter, createStudyDay, openAs } from "./study-day";

/**
 * A day's session played with the keyboard only, from Today through the capsules, the lesson and
 * practice to the summary, with an accessibility scan (light and dark) of every screen on the way:
 * questions, their feedback and each completion moment. Both modes, phone and desktop widths;
 * Fun, which is dark only, is scanned on a light device and checked to stay dark.
 */

const SCAN_TIMEOUT_MS = 240_000;

test.describe.configure({ timeout: SCAN_TIMEOUT_MS });

for (const mode of MODES) {
  test.describe(`Accessibility of a session by keyboard in ${mode}`, () => {
    for (const viewport of ACCESSIBILITY_VIEWPORTS) {
      test(`a session by keyboard is accessible in ${mode} on ${viewport.name}`, async ({
        browser,
      }) => {
        const { user } = await createStudyDay({ mode });
        const page = await openAs(browser, user);
        await page.setViewportSize(viewport.size);
        const violations: string[] = [];

        const scan = async (label: string) => {
          violations.push(...(await scanCurrentScreen(page, label)));
        };

        await page.goto("/today");
        const start = page.getByRole("button", { name: mode === "fun" ? /^Take off/u : /^Start/u });
        await tabTo(page, start);
        await scan("Today");
        await page.keyboard.press("Enter");

        await expect(page.getByRole("heading", { name: /^Capsule one/u })).toBeVisible();
        await scan("a capsule");
        await page.keyboard.press("1");

        await expect(
          page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"),
        ).toBeVisible();

        await scan("a capsule's feedback");
        await continueWithEnter(page);
        await answerRight(page, /^Capsule two/u);

        await expect(page.getByRole("main").getByText("Brain Power")).toBeVisible();
        await scan("the capsules' moment");
        await page.keyboard.press("Enter");

        await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
        await scan("the session's lesson");

        // The lesson's one check: a number key picks the answer (its listener attaches on
        // hydration, so it retries), Enter checks it and Enter again finishes the lesson.
        await expect(async () => {
          await page.keyboard.press("2");

          await expect(
            page.getByRole("radio", { name: "Where the electron is most likely to be found" }),
          ).toBeChecked({ timeout: 1000 });
        }).toPass({ timeout: 5000 });

        await page.keyboard.press("Enter");
        await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
        await page.keyboard.press("Enter");

        await expect(
          page.getByRole("heading", { level: 2, name: "Lesson complete" }),
        ).toBeVisible();

        await scan("the lesson's moment");
        await page.keyboard.press("Enter");

        await expect(page.getByRole("heading", { name: /^Practice one/u })).toBeVisible();
        await scan("practice");
        await answerRight(page, /^Practice one/u);
        await answerRight(page, /^Practice two/u);

        await expect(page.getByRole("heading", { level: 1, name: "Practice done" })).toBeVisible();
        await tabTo(page, page.getByRole("button", { name: /^See what changed/u }));
        await page.keyboard.press("Enter");

        await expect(
          page.getByRole("heading", {
            level: 1,
            name: mode === "fun" ? "Flight plan complete!" : "Today's session is done",
          }),
        ).toBeVisible();

        await scan("the session's summary");
        expect(violations, violations.join("\n")).toEqual([]);
        await page.context().close();
      });
    }
  });
}
