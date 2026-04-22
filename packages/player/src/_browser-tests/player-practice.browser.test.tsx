import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: practice activities", () => {
  test("renders a leading static scenario step and still completes with question scoring", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "practice",
        steps: [
          buildSerializedStep({
            content: {
              text: "I'm closing the support queue with Maya, and one customer report still does not line up with the refund totals.",
              title: "Night shift",
              variant: "text" as const,
            },
            id: "practice-scenario",
          }),
          buildSerializedStep({
            content: {
              context: "Maya says the mismatch only appears on orders with manual discounts.",
              kind: "core" as const,
              options: [
                {
                  feedback: "Yes. Start with the shared pattern before blaming a random order.",
                  isCorrect: true,
                  text: "Check the discounted orders first",
                },
                {
                  feedback: "That skips the one pattern we already know matters.",
                  isCorrect: false,
                  text: "Ignore discounts and inspect the latest order",
                },
              ],
              question: "What should I check first?",
            },
            id: "practice-question",
            kind: "multipleChoice",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextActivityHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("heading", { name: "Night shift" })).toBeInTheDocument();
    await expect
      .element(
        page.getByText(
          "I'm closing the support queue with Maya, and one customer report still does not line up with the refund totals.",
        ),
      )
      .toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });

    await expect
      .element(page.getByRole("heading", { name: "What should I check first?" }))
      .toBeInTheDocument();

    await page.getByRole("radio", { name: "Check the discounted orders first" }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect.element(page.getByText("1/1")).toBeInTheDocument();
    await expect.element(page.getByText(/\+10\s*BP/i)).toBeInTheDocument();
  });
});
