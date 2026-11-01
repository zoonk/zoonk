import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { type ActivityContent, activityStep, explanationStep } from "../preview/preview-steps";

const reading = explanationStep({
  text: "A chemical change makes a new substance.",
  title: "Two kinds of change",
});

function playLesson(steps: Parameters<typeof buildLesson>[0]) {
  renderLessonPlayer({ lesson: buildLesson(steps) });
}

function activity(content: ActivityContent = activityContentFixtures.categorize) {
  return activityStep({ content });
}

async function sortItem({ group, item }: { group: string; item: string }) {
  await page.getByRole("button", { exact: true, name: item }).click();
  await page.getByRole("button", { name: `Put ${item} in ${group}` }).click();
}

async function goBackAndReturn() {
  await page.getByRole("button", { name: "Previous screen" }).click();
  await expect.element(page.getByRole("heading", { name: "Two kinds of change" })).toBeVisible();
  await page.getByRole("button", { name: /^Next/u }).click();
}

describe("going back to reread", () => {
  it("keeps an activity as the learner left it until they come back and check it", async () => {
    playLesson([reading, activity()]);
    await page.getByRole("button", { name: /^Next/u }).click();
    await sortItem({ group: "New substance", item: "Burning wood" });
    await page.getByRole("button", { exact: true, name: "Melting ice" }).click();

    await goBackAndReturn();

    await expect.element(page.getByText("1 of 3 sorted", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Put Melting ice in Same substance" }).click();
    await sortItem({ group: "New substance", item: "Rusting iron" });
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("brings a chart back where the learner moved it, never at the check's answer", async () => {
    const { calculator } = engineModeFixtures.formulaModel;
    playLesson([reading, activity({ ...calculator, template: "formulaModel" })]);
    await page.getByRole("button", { name: /^Next/u }).click();
    await pressOnSlider("Extra per month", "ArrowRight", 2);
    await expect.element(valueInput()).not.toHaveValue("");
    const field = valueInput().element();
    const typed = field instanceof HTMLInputElement ? field.value : "";

    await goBackAndReturn();

    await expect
      .element(page.getByRole("slider", { name: "Extra per month" }))
      .toHaveAttribute("aria-valuenow", "100");

    await expect.element(valueInput()).toHaveValue(typed);
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("starts a missed activity over when it comes back", async () => {
    playLesson([reading, activity()]);
    await page.getByRole("button", { name: /^Next/u }).click();
    await sortItem({ group: "Same substance", item: "Burning wood" });
    await sortItem({ group: "Same substance", item: "Melting ice" });
    await sortItem({ group: "New substance", item: "Rusting iron" });
    await checkActivity();
    await expectVerdict("Not quite");

    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Previous screen" }))
      .not.toBeInTheDocument();
  });
});
