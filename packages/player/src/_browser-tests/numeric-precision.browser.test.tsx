import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep } from "../preview/preview-steps";
import type * as NextIntl from "next-intl";

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof NextIntl>()),
  useLocale: () => "pt",
}));

describe("numeric answer precision", () => {
  it("keeps a canvas-produced close miss distinct in the Portuguese input and feedback", async () => {
    const { numberLine } = activityContentFixtures;

    const content = {
      ...numberLine,
      check: {
        ...numberLine.check,
        answer: 0.125,
        tolerance: { kind: "absolute" as const, value: 0.0001 },
        unit: undefined,
      },
      fields: {
        ...numberLine.fields,
        max: 0.126,
        min: 0.124,
        moves: [{ by: 0.0004 }],
        start: 0.125,
        step: 0.0001,
        unit: undefined,
      },
    };

    renderLessonPlayer({ lesson: buildLesson([activityStep({ content })], { language: "pt" }) });
    await pressOnSlider("Your answer on the number line", "ArrowRight", 4);
    await expect.element(valueInput()).toHaveValue("0,1254");
    await checkActivity();
    await expectVerdict("Not quite");
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect.element(feedback.getByText("0,1254", { exact: true })).toBeVisible();
    await expect.element(feedback.getByText("0,125", { exact: true })).toBeVisible();
  });
});
