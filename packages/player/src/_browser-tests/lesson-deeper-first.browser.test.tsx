import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { teachingStep } from "../_test-utils/lesson-steps";
import { buildLesson, renderLessonPlayer } from "../_test-utils/render-lesson-player";

/**
 * "Go deeper" by default, for learners who asked for a more technical register: an explanation
 * opens its shared deeper version first, with one tap back to the original and one back again.
 */

const DEEPER_TEXT =
  "The electron is described by a **wave function**; its squared magnitude gives the probability density.";

/** The shared explanation with a stored "Go deeper" version, which the lesson read includes. */
function explanationWithDeeper() {
  const content = parseStepContent("explanation", {
    text: DEEPER_TEXT,
    title: "The wave function",
  });

  const deeper = { content, id: crypto.randomUUID() };
  return { ...teachingStep("explanation"), variants: { deeper, simpler: null } };
}

describe("deeper by default", () => {
  it("opens an explanation's deeper version first", async () => {
    const lesson = buildLesson([explanationWithDeeper(), teachingStep("check")]);
    renderLessonPlayer({ deeperByDefault: true, lesson, mode: "fun" });

    await expect.element(page.getByText("Deeper version")).toBeVisible();
    await expect.element(page.getByText("The wave function")).toBeVisible();
    await expect.element(page.getByText("A cloud, not a little ball")).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Show the original" }).click();
    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
    await expect.element(page.getByText("Deeper version")).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Go deeper" }).click();
    await expect.element(page.getByText("The wave function")).toBeVisible();
  });
});
