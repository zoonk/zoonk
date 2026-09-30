import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { tabTo } from "./keyboard-focus";
import { MODES, type Mode, setDeviceMode } from "./learn-personas";

/**
 * The lesson player by keyboard alone, at desktop size, in Focus and Fun: Enter runs the screen's
 * main action from anywhere, yet a focused control keeps its own keys; number keys answer; the
 * arrows move between reading screens; sheets hold the lesson's keys while they're open.
 */

const DESKTOP = { height: 900, width: 1280 };
const RIGHT_TYPED = "It shows where the electron is likely to be";

async function openLesson(page: Page, { lessonId, mode }: { lessonId: string; mode: Mode }) {
  await page.setViewportSize(DESKTOP);
  await setDeviceMode(page.context(), mode);
  await page.goto(`/learn/${lessonId}`);
}

/** A screen's verdict, as the player announces it. */
function verdict(page: Page, text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

for (const mode of MODES) {
  test.describe(`Lesson by keyboard in ${mode}`, () => {
    test("a focused control keeps Enter, and a sheet holds the lesson's keys", async ({ page }) => {
      const { lesson, steps } = await playableLessonFixture({ steps: ["explanation", "check"] });

      await stepVariantFixture({
        content: { text: "Think of a blur instead of a dot." },
        kind: "simpler",
        stepId: steps[0]!.id,
      });

      await openLesson(page, { lessonId: lesson.id, mode });
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      // Enter on "Simpler" opens it; it doesn't move the lesson on.
      const simplerButton = page.getByRole("button", { name: "Simpler" });
      await tabTo(page, simplerButton);
      await page.keyboard.press("Enter");

      const simpler = page.getByRole("dialog", { name: "Simpler" });
      await expect(simpler.getByText("Think of a blur instead of a dot.")).toBeVisible();

      // The arrows wait while the sheet is open, and Escape closes only the sheet.
      await page.keyboard.press("ArrowRight");
      await expect(simpler).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(simpler).toBeHidden();
      await expect(simplerButton).toBeFocused();
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      // Anywhere else, the keys move the lesson: the arrow to the check, a number, then Enter.
      await page.keyboard.press("ArrowRight");
      await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
      await page.keyboard.press("2");

      await expect(
        page.getByRole("radio", { name: "Where the electron is most likely to be found" }),
      ).toBeChecked();

      await page.keyboard.press("Enter");
      await expect(verdict(page, "Correct!")).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    });

    test("a written answer checks and continues with Enter, and Escape stays in the field", async ({
      page,
    }) => {
      const { lesson } = await playableLessonFixture({ steps: ["typedAnswer", "summary"] });
      await openLesson(page, { lessonId: lesson.id, mode });

      const answer = page.getByRole("textbox", {
        name: "In your own words: why is the electron drawn as a cloud?",
      });

      await answer.click();
      await page.keyboard.type(RIGHT_TYPED);

      // Escape while typing never leaves the lesson and its answer.
      await page.keyboard.press("Escape");
      await expect(answer).toHaveValue(RIGHT_TYPED);

      await answer.focus();
      await page.keyboard.press("Enter");
      await expect(verdict(page, "Correct!")).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    });

    test("the close button holds its Esc hint beside the X, and phones keep the plain X", async ({
      page,
    }) => {
      const { lesson } = await playableLessonFixture({ steps: ["explanation"] });
      await openLesson(page, { lessonId: lesson.id, mode });

      const close = page.getByRole("link", { name: "Close lesson" });
      const hint = close.locator("kbd");
      await expect(hint).toHaveText("Esc");

      const [icon, hintBox] = await Promise.all([
        close.locator("svg").boundingBox(),
        hint.boundingBox(),
      ]);

      expect((icon?.x ?? 0) + (icon?.width ?? 0)).toBeLessThanOrEqual(hintBox?.x ?? 0);

      await page.setViewportSize({ height: 812, width: 375 });
      await expect(hint).toBeHidden();

      const phoneBox = await close.boundingBox();
      expect(phoneBox?.width).toBe(phoneBox?.height);
    });

    test("an activity keeps digits in its field, and Enter checks the number", async ({ page }) => {
      const { lesson } = await playableLessonFixture({
        steps: [{ content: activityContentFixtures.numberLine, kind: "activity" }],
      });

      await openLesson(page, { lessonId: lesson.id, mode });

      const value = page.getByRole("textbox", { name: "What is the value?" });
      await value.fill("");
      await value.pressSequentially("5");
      await expect(value).toHaveValue("5");

      await page.keyboard.press("Enter");

      await expect(
        page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"),
      ).toBeVisible();
    });
  });
}
