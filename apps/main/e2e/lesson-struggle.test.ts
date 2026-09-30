import { stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { MODES, type Mode, setDeviceMode } from "./learn-personas";

/**
 * Struggle detection: two misses in a row on the same idea, or a long pause on an explanation,
 * offer a simpler version at that moment, in Focus and Fun.
 */

const SIMPLER_TEXT = "Think of a blur instead of a dot.";

/** An explanation with a shared simpler version, then two checks on its idea. */
async function createLesson() {
  const { lesson, steps } = await playableLessonFixture({
    steps: ["explanation", "check", "check"],
  });

  await stepVariantFixture({
    content: { text: SIMPLER_TEXT },
    kind: "simpler",
    stepId: steps[0]!.id,
  });

  return lesson;
}

async function openLesson(page: Page, { lessonId, mode }: { lessonId: string; mode: Mode }) {
  await setDeviceMode(page.context(), mode);
  await page.goto(`/learn/${lessonId}`);
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
}

async function missCheck(page: Page) {
  await page.getByRole("radio", { name: "The electron's size" }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect(page.getByRole("status").filter({ hasText: "Not quite" })).toBeVisible();
}

for (const mode of MODES) {
  test.describe(`Struggle help in ${mode} mode`, () => {
    test("two misses in a row offer the idea's simpler explanation", async ({ page }) => {
      const lesson = await createLesson();
      await openLesson(page, { lessonId: lesson.id, mode });

      await page.getByRole("button", { name: /^Next/u }).click();
      await missCheck(page);

      const offer = page.getByText("This one is tricky. A simpler explanation might help.");
      await expect(offer).toBeHidden();

      await page.getByRole("button", { name: /^Continue/u }).click();
      await missCheck(page);
      await expect(offer).toBeVisible();

      await page.getByRole("button", { name: "Show a simpler version" }).click();
      const simpler = page.getByRole("dialog", { name: "Simpler" });
      await expect(simpler.getByText(SIMPLER_TEXT)).toBeVisible();

      await simpler.getByRole("button", { name: "Got it" }).click();
      await expect(simpler).toBeHidden();

      // "No thanks" puts the offer away; the lesson goes on as before.
      await page.getByRole("button", { name: "No thanks" }).click();
      await expect(offer).toBeHidden();
      await expect(page.getByRole("button", { name: /^Continue/u })).toBeVisible();
    });

    test("a long pause on an explanation offers a simpler version", async ({ page }) => {
      const lesson = await createLesson();
      await page.clock.install();
      await openLesson(page, { lessonId: lesson.id, mode });

      const offer = page.getByText("Taking your time? A simpler version might help.");
      await page.clock.fastForward("00:20");
      await expect(offer).toBeHidden();

      await page.clock.fastForward("00:30");
      await expect(offer).toBeVisible();

      await page.getByRole("button", { name: "Show a simpler version" }).click();

      await expect(
        page.getByRole("dialog", { name: "Simpler" }).getByText(SIMPLER_TEXT),
      ).toBeVisible();
    });
  });
}
