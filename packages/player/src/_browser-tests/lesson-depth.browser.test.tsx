import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { teachingStep } from "../_test-utils/lesson-steps";
import {
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";

/**
 * "Simpler", "Go deeper" and the example line, written for the learner when they ask or when the
 * screen opens: what the player shows for each answer the host gives.
 */

const EXAMPLE_LINE = "Like a spinning fan: you see where the blades might be, not where they are.";

function openExplanation(overrides: Partial<LessonPlayerAdapters>) {
  const lesson = buildLesson([teachingStep("explanation"), teachingStep("check")]);
  renderLessonPlayer({ adapters: buildAdapters(lesson, overrides), lesson, mode: "fun" });

  return lesson;
}

describe("versions and examples written on request", () => {
  it("says when today's help is used up or the screen has no version", async () => {
    const requestVariant = vi.fn<NonNullable<LessonPlayerAdapters["requestVariant"]>>(({ kind }) =>
      Promise.resolve(
        kind === "deeper"
          ? { status: "unsupported" as const }
          : { status: "limitReached" as const, tier: "guest" as const },
      ),
    );

    openExplanation({ requestVariant });

    await page.getByRole("button", { name: "Simpler" }).click();
    const simpler = page.getByRole("dialog", { name: "Simpler" });

    await expect
      .element(
        simpler.getByText("You've used today's free help. Create a free account to keep going."),
      )
      .toBeVisible();

    await expect
      .element(simpler.getByRole("link", { name: "Create a free account" }))
      .toBeVisible();

    await press("Escape");
    await expect.element(simpler).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Go deeper" }).click();

    await expect
      .element(
        page
          .getByRole("dialog", { name: "Go deeper" })
          .getByText("This screen is already as simple and as deep as it gets."),
      )
      .toBeVisible();
  });

  it("shows the learner's example line under the explanation once it's written", async () => {
    const { promise: written, resolve: write } = Promise.withResolvers<string | null>();
    const getExampleLine = vi.fn(() => written);

    const lesson = openExplanation({ getExampleLine });

    // The screen doesn't wait for the line.
    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
    const example = page.getByRole("complementary", { name: "Your example" });
    await expect.element(example).not.toBeInTheDocument();

    write(EXAMPLE_LINE);
    await expect.element(example).toHaveTextContent(EXAMPLE_LINE);
    expect(getExampleLine).toHaveBeenCalledWith({ stepId: lesson.steps[0]?.id });
  });
});
