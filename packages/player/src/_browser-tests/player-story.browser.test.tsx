import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

const STORY_METRICS = [{ label: "Production" }, { label: "Morale" }];
const STORY_CONTEXT_METRICS = [...STORY_METRICS, { label: "Safety" }];

const STORY_OUTCOMES = {
  bad: {
    narrative: "The factory barely holds together",
    title: "Hard Lesson",
  },
  good: {
    narrative: "The factory stabilizes",
    title: "Solid Manager",
  },
  ok: {
    narrative: "The factory recovers unevenly",
    title: "Mixed Shift",
  },
  perfect: {
    image: {
      prompt: "Recovered factory floor with a confident team and stable output",
      url: buildInlineImageUrl({ label: "Story outcome" }),
    },
    narrative: "Excellent leadership",
    title: "Great Manager",
  },
  terrible: {
    narrative: "The factory falls apart",
    title: "Learning Moment",
  },
};
const STORY_CONTEXT_OUTCOMES = {
  ...STORY_OUTCOMES,
  perfect: {
    ...STORY_OUTCOMES.perfect,
    image: {
      prompt: "Recovered factory floor with a confident team and stable output",
      url: buildInlineImageUrl({ label: "Story outcome context" }),
    },
  },
};

/**
 * Verifies the currently visible step image has the standard full-image escape
 * hatch. Story steps render images in several layouts, so this keeps the
 * behavior assertion identical while each screen keeps its own composition.
 */
async function expectCurrentStepImageExpands(imageAlt: string) {
  await page.getByRole("button", { name: /open full image/i }).click();
  const dialog = page.getByRole("dialog", { name: /full image/i });

  await expect.element(dialog.getByAltText(imageAlt)).toBeInTheDocument();

  await page.getByRole("button", { name: /close full image/i }).click();
  await expect.element(dialog).not.toBeInTheDocument();
}

describe("player browser integration: story", () => {
  test("runs the shared story flow from intro to completion", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "story",
        steps: [
          buildSerializedStep({
            content: {
              image: {
                prompt: "Factory floor at sunrise with anxious workers waiting for instructions",
                url: buildInlineImageUrl({ label: "Story intro" }),
              },
              text: "You are leading the factory team.",
              title: "Factory trouble",
              variant: "intro" as const,
            },
            id: "story-intro",
            kind: "static",
          }),
          buildSerializedStep({
            content: {
              choices: [
                {
                  alignment: "strong" as const,
                  consequence: "Production surges",
                  id: "story-choice-1",
                  metricEffects: [
                    { effect: "positive" as const, metric: "Production" },
                    { effect: "positive" as const, metric: "Morale" },
                  ],
                  stateImage: {
                    prompt: "Factory floor after training begins and the team regains confidence",
                    url: buildInlineImageUrl({ label: "Story state train" }),
                  },
                  text: "Invest in training",
                },
                {
                  alignment: "weak" as const,
                  consequence: "Morale drops",
                  id: "story-choice-2",
                  metricEffects: [
                    { effect: "negative" as const, metric: "Production" },
                    { effect: "negative" as const, metric: "Morale" },
                  ],
                  stateImage: {
                    prompt:
                      "Factory floor after cuts with workers frustrated and stations falling behind",
                    url: buildInlineImageUrl({ label: "Story state cut" }),
                  },
                  text: "Cut costs",
                },
              ],
              image: {
                prompt: "Factory floor in crisis with stalled stations and workers waiting",
                url: buildInlineImageUrl({ label: "Story step" }),
              },
              problem: "A crisis hits the factory floor",
            },
            id: "story-decision",
            kind: "story",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              metrics: STORY_METRICS,
              outcomes: STORY_OUTCOMES,
              variant: "storyOutcome" as const,
            },
            id: "story-outcome",
            kind: "static",
            position: 2,
          }),
          buildSerializedStep({
            content: {
              text: "Training investment builds capacity",
              title: "Resource Allocation",
              variant: "text" as const,
            },
            id: "story-debrief",
            kind: "static",
            position: 3,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(
        page.getByAltText("Factory floor at sunrise with anxious workers waiting for instructions"),
      )
      .toBeInTheDocument();

    await expectCurrentStepImageExpands(
      "Factory floor at sunrise with anxious workers waiting for instructions",
    );

    await page.getByRole("button", { name: /begin/i }).click();
    await page.getByRole("radio", { name: /invest in training/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect
      .element(
        page.getByAltText("Factory floor after training begins and the team regains confidence"),
      )
      .toBeInTheDocument();

    await expectCurrentStepImageExpands(
      "Factory floor after training begins and the team regains confidence",
    );

    await page.getByRole("button", { name: /continue/i }).click();

    await expect.element(page.getByRole("heading", { name: "Great Manager" })).toBeInTheDocument();
    await expect
      .element(page.getByAltText("Recovered factory floor with a confident team and stable output"))
      .toBeInTheDocument();

    await expectCurrentStepImageExpands(
      "Recovered factory floor with a confident team and stable output",
    );

    await page.getByRole("button", { name: /continue/i }).click();
    await expect
      .element(page.getByRole("heading", { name: "Resource Allocation" }))
      .toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("status")).toBeInTheDocument();
  });

  test("shows story context in lesson info and metric impact on feedback", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "story",
        steps: [
          buildSerializedStep({
            content: {
              image: {
                prompt: "Factory floor at sunrise with anxious workers waiting for instructions",
                url: buildInlineImageUrl({ label: "Story intro context" }),
              },
              text: "You are leading the factory team.",
              title: "Factory trouble",
              variant: "intro" as const,
            },
            id: "story-intro-context",
            kind: "static",
          }),
          buildSerializedStep({
            content: {
              choices: [
                {
                  alignment: "strong" as const,
                  consequence: "Production surges",
                  id: "story-choice-1",
                  metricEffects: [
                    { effect: "positive" as const, metric: "Production" },
                    { effect: "positive" as const, metric: "Morale" },
                  ],
                  stateImage: {
                    prompt: "Factory floor after training begins and the team regains confidence",
                    url: buildInlineImageUrl({ label: "Story state train context" }),
                  },
                  text: "Invest in training",
                },
                {
                  alignment: "weak" as const,
                  consequence: "Morale drops",
                  id: "story-choice-2",
                  metricEffects: [
                    { effect: "negative" as const, metric: "Production" },
                    { effect: "negative" as const, metric: "Morale" },
                  ],
                  stateImage: {
                    prompt:
                      "Factory floor after cuts with workers frustrated and stations falling behind",
                    url: buildInlineImageUrl({ label: "Story state cut context" }),
                  },
                  text: "Cut costs",
                },
              ],
              image: {
                prompt: "Factory floor in crisis with stalled stations and workers waiting",
                url: buildInlineImageUrl({ label: "Story step context" }),
              },
              problem: "A crisis hits the factory floor",
            },
            id: "story-decision-context",
            kind: "story",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              metrics: STORY_CONTEXT_METRICS,
              outcomes: STORY_CONTEXT_OUTCOMES,
              variant: "storyOutcome" as const,
            },
            id: "story-outcome-context",
            kind: "static",
            position: 2,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("status", { name: /current status/i }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: /begin/i }).click();

    await expect
      .element(page.getByRole("status", { name: /current status/i }))
      .not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /context/i })).not.toBeInTheDocument();
    await page.getByRole("button", { name: /lesson info/i }).click();

    const lessonInfoDialog = page.getByRole("dialog", { name: "Test Lesson" });

    await expect
      .element(lessonInfoDialog)
      .toHaveAccessibleDescription("You are leading the factory team.");

    await expect
      .element(lessonInfoDialog)
      .not.toHaveAccessibleDescription("Test lesson description");

    await page.getByRole("button", { name: /lesson info/i }).click();
    await expect.element(lessonInfoDialog).not.toBeInTheDocument();

    await page.getByRole("radio", { name: /invest in training/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect.element(page.getByText("Production surges")).toBeInTheDocument();
    await expect.element(page.getByText(/your answer:/i)).not.toBeInTheDocument();
    const metricChanges = page.getByRole("list", { name: /metric changes/i });

    await expect.element(metricChanges).toBeInTheDocument();
    await expect.element(metricChanges).toHaveTextContent(/Production.*Morale.*Safety/s);

    await expect
      .element(page.getByRole("listitem", { name: /production \+15 65/i }))
      .toBeInTheDocument();

    await expect
      .element(page.getByRole("listitem", { name: /morale \+15 65/i }))
      .toBeInTheDocument();

    await expect.element(page.getByRole("listitem", { name: /safety 0 50/i })).toBeInTheDocument();

    await expect
      .element(page.getByRole("status", { name: /current status/i }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect
      .element(page.getByRole("status", { name: /current status/i }))
      .not.toBeInTheDocument();
  });
});
