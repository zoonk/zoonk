import { type Locator } from "@playwright/test";
import { ACCESSIBILITY_VIEWPORTS, scanCurrentScreen } from "@zoonk/e2e/fixtures/accessibility";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { MODES, showInMode } from "./learn-personas";

/**
 * A lesson played by keyboard, with an accessibility scan (light and dark) of every state the
 * route scan can't open by URL: a guess's reveal, the tutor, the screen's menu, a wrong answer's
 * feedback, a typed answer's grade, the summary, the missed question coming back and the
 * completion moment. Both modes, phone and desktop widths; Fun, which is dark only, is scanned on
 * a light device and checked to stay dark.
 */

const SCAN_TIMEOUT_MS = 240_000;
const LESSON_STEPS = ["hook", "explanation", "check", "typedAnswer", "summary"] as const;
const WRONG_OPTION = "1";
const RIGHT_OPTION = "2";
const NO = "3";

test.describe.configure({ timeout: SCAN_TIMEOUT_MS });

function verdict(page: Page, text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

/** Picks an option with its number key; the listener attaches on hydration, so it retries. */
async function pick(page: Page, key: string, option: string) {
  await expect(async () => {
    await page.keyboard.press(key);
    await expect(page.getByRole("radio", { name: option })).toBeChecked({ timeout: 1000 });
  }).toPass({ timeout: 5000 });
}

/** Enter runs the screen's main action (check, then continue) when focus isn't on a control. */
async function enterTo(page: Page, next: Locator) {
  await page.keyboard.press("Enter");
  await expect(next).toBeVisible();
}

/**
 * Opens a layer with its button, scans it and closes it with Escape, which closes only the layer
 * and puts focus back on its button.
 */
async function scanLayer(
  page: Page,
  {
    button,
    label,
    layer,
    scan,
  }: { button: string; label: string; layer: Locator; scan: (label: string) => Promise<void> },
) {
  const opener = page.getByRole("button", { name: button });

  await tabTo(page, opener);
  await page.keyboard.press("Enter");
  await expect(layer).toBeVisible();
  await scan(label);
  await page.keyboard.press("Escape");
  await expect(layer).toBeHidden();
  await expect(opener).toBeFocused();
}

for (const mode of MODES) {
  test.describe(`Accessibility of a lesson by keyboard in ${mode}`, () => {
    for (const viewport of ACCESSIBILITY_VIEWPORTS) {
      test(`a lesson by keyboard is accessible in ${mode} on ${viewport.name}`, async ({
        noProgressUser,
        userWithoutProgress: page,
      }) => {
        const violations: string[] = [];

        const scan = async (label: string) => {
          violations.push(...(await scanCurrentScreen(page, label)));
        };

        const [{ lesson }] = await Promise.all([
          playableLessonFixture({ steps: [...LESSON_STEPS] }),
          showInMode(page.context(), { mode, userId: noProgressUser.id }),
        ]);

        await page.setViewportSize(viewport.size);
        await page.goto(`/learn/${lesson.id}`);

        await expect(page.getByText("Guess first · no points")).toBeVisible();
        await pick(page, NO, "No");
        await enterTo(page, verdict(page, "Good guess!"));
        await scan("a guess's reveal");
        await enterTo(page, page.getByText("A cloud, not a little ball"));

        await scanLayer(page, {
          button: "Ask a question",
          label: "the tutor",
          layer: page.getByRole("dialog", { name: "Ask questions" }),
          scan,
        });

        await scanLayer(page, {
          button: "Screen options",
          label: "the screen's menu",
          layer: page.getByRole("menu"),
          scan,
        });

        // Focus is back on the menu's button, where Enter would reopen it, so move on to Next.
        await tabTo(page, page.getByRole("button", { name: /^Next/u }));
        await page.keyboard.press("Enter");
        await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
        await pick(page, WRONG_OPTION, "The electron's exact path");
        await enterTo(page, verdict(page, "Not quite"));
        await scan("a wrong answer's feedback");

        const typed = page.getByRole("textbox", {
          name: "In your own words: why is the electron drawn as a cloud?",
        });

        await enterTo(page, typed);
        await tabTo(page, typed);
        await page.keyboard.type("It shows where the electron is likely to be");
        await tabTo(page, page.getByRole("button", { name: /^Check/u }));
        await page.keyboard.press("Enter");
        await expect(verdict(page, "Correct!")).toBeVisible();
        await scan("a typed answer's grade");
        await enterTo(page, page.getByRole("heading", { name: "Summary" }));
        await scan("the summary");

        // The check answered wrong comes back once at the end; this time it's answered right.
        await enterTo(page, page.getByText('What does the electron "cloud" show?'));
        await pick(page, RIGHT_OPTION, "Where the electron is most likely to be found");
        await enterTo(page, verdict(page, "Correct!"));
        await enterTo(page, page.getByRole("heading", { level: 2, name: "Lesson complete" }));

        await scan("the completion moment");
        expect(violations, violations.join("\n")).toEqual([]);
      });
    }
  });
}
