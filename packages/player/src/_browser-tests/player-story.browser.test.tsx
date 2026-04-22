import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: story", () => {
  test("runs the shared story flow from intro to completion", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "story",
        steps: [
          buildSerializedStep({
            content: {
              intro: "You are leading the factory team.",
              metrics: ["Production", "Morale"],
              variant: "storyIntro" as const,
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
                  text: "Cut costs",
                },
              ],
              situation: "A crisis hits the factory floor",
            },
            id: "story-decision",
            kind: "story",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              metrics: ["Production", "Morale"],
              outcomes: [
                {
                  minStrongChoices: 1,
                  narrative: "Excellent leadership",
                  title: "Great Manager",
                },
              ],
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

    await page.getByRole("button", { name: /begin/i }).click();
    await page.getByRole("radio", { name: /invest in training/i }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect.element(page.getByRole("heading", { name: "Great Manager" })).toBeInTheDocument();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect
      .element(page.getByRole("heading", { name: "Resource Allocation" }))
      .toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("status")).toBeInTheDocument();
  });

  test("shows story context recall and metrics only during active decision states", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "story",
        steps: [
          buildSerializedStep({
            content: {
              intro: "You are leading the factory team.",
              metrics: ["Production", "Morale"],
              variant: "storyIntro" as const,
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
                  text: "Cut costs",
                },
              ],
              situation: "A crisis hits the factory floor",
            },
            id: "story-decision-context",
            kind: "story",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              metrics: ["Production", "Morale"],
              outcomes: [
                {
                  minStrongChoices: 1,
                  narrative: "Excellent leadership",
                  title: "Great Manager",
                },
              ],
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

    await expect.element(page.getByRole("status", { name: /current status/i })).toBeInTheDocument();
    await page.getByRole("button", { name: /context/i }).click();
    await expect.element(page.getByText("You are leading the factory team.")).toBeInTheDocument();
    await page.getByRole("button", { name: /context/i }).click();
    await expect
      .element(page.getByText("You are leading the factory team."))
      .not.toBeInTheDocument();

    await page.getByRole("radio", { name: /invest in training/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect.element(page.getByText("Production surges")).toBeInTheDocument();
    await expect.element(page.getByText(/your answer:/i)).not.toBeInTheDocument();
    await expect.element(page.getByRole("status", { name: /current status/i })).toBeInTheDocument();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect
      .element(page.getByRole("status", { name: /current status/i }))
      .not.toBeInTheDocument();
  });
});
