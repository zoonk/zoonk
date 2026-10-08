import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { teachingStep } from "../_test-utils/lesson-steps";
import { buildLesson, renderLessonPlayer } from "../_test-utils/render-lesson-player";

/**
 * A lesson built from the learner's own material says where each screen comes from: the slide it
 * cites, or that an explanation no slide supports isn't in their material.
 */

const NOT_IN_MATERIAL = "Not in your material";

describe("a lesson built from the learner's material", () => {
  it("cites a screen's slide and says when an explanation isn't in the material", async () => {
    const fromSlide = {
      ...teachingStep("explanation"),
      citation: {
        kind: "material" as const,
        page: 3,
        title: "Aula 5 - Glicolise",
        unit: "slide" as const,
      },
    };

    const beyondSlides = {
      ...teachingStep("explanation"),
      citation: { kind: "notInMaterial" as const },
    };

    renderLessonPlayer({ lesson: buildLesson([fromSlide, beyondSlides, teachingStep("check")]) });

    await expect
      .element(page.getByLabelText("From your material: Aula 5 - Glicolise, slide 3"))
      .toBeVisible();

    await expect.element(page.getByText(NOT_IN_MATERIAL)).not.toBeInTheDocument();
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(page.getByText(NOT_IN_MATERIAL)).toBeVisible();

    await expect.element(page.getByLabelText(/^From your material/u)).not.toBeInTheDocument();
  });
});
