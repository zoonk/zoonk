import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { runInMobilePlayerViewport } from "../_test-utils/browser-viewport";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import { buildSerializedLesson, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: practice lessons", () => {
  it("shows only the bottom-bar check button on mobile practice questions", async () => {
    await runInMobilePlayerViewport(async () => {
      renderPlayer({
        lesson: buildSerializedLesson({
          kind: "practice",
          steps: [
            buildSerializedStep({
              content: {
                context: "Maya says the mismatch only appears on orders with manual discounts.",
                image: {
                  prompt:
                    "A refund dashboard filtered to discounted orders with one outlier row highlighted",
                  url: buildInlineImageUrl({
                    label:
                      "A refund dashboard filtered to discounted orders with one outlier row highlighted",
                  }),
                },
                options: [
                  {
                    feedback: "Yes. Start with the shared pattern before blaming a random order.",
                    id: "check-discounted-orders",
                    isCorrect: true,
                    text: "Check the discounted orders first",
                  },
                  {
                    feedback: "That skips the one pattern we already know matters.",
                    id: "inspect-latest-order",
                    isCorrect: false,
                    text: "Ignore discounts and inspect the latest order",
                  },
                ],
                question: "What should I check first?",
              },
              id: "practice-question",
              kind: "multipleChoice",
            }),
          ],
        }),
        navigation: buildNavigation({ nextLessonHref: null }),
        viewer: buildAuthenticatedViewer(),
      });

      await page.getByRole("radio", { name: "Check the discounted orders first" }).click();

      const visibleCheckButtons = screen.getAllByRole("button", { name: /check/iu });

      expect(visibleCheckButtons).toHaveLength(1);

      await expect
        .element(
          page
            .getByRole("toolbar", { name: /lesson controls/iu })
            .getByRole("button", { name: /check/iu }),
        )
        .toBeInTheDocument();
    });
  });

  it("starts on the first practice question and completes with question scoring", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "practice",
        steps: [
          buildSerializedStep({
            content: {
              context: "Maya says the mismatch only appears on orders with manual discounts.",
              image: {
                prompt:
                  "A refund dashboard filtered to discounted orders with one outlier row highlighted",
                url: buildInlineImageUrl({
                  label:
                    "A refund dashboard filtered to discounted orders with one outlier row highlighted",
                }),
              },
              options: [
                {
                  feedback: "Yes. Start with the shared pattern before blaming a random order.",
                  id: "check-discounted-orders",
                  isCorrect: true,
                  text: "Check the discounted orders first",
                },
                {
                  feedback: "That skips the one pattern we already know matters.",
                  id: "inspect-latest-order",
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
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("heading", { name: "What should I check first?" }))
      .toBeInTheDocument();

    await expect
      .element(page.getByAltText(/refund dashboard filtered to discounted orders/iu))
      .toBeInTheDocument();

    await page.getByRole("radio", { name: "Check the discounted orders first" }).click();
    await page.getByRole("button", { name: /check/iu }).click();
    await page.getByRole("button", { name: /continue/iu }).click();

    await expect.element(page.getByText("100%")).toBeInTheDocument();
    await expect.element(page.getByText(/\+10\s*BP/iu)).not.toBeInTheDocument();

    await expect
      .element(page.getByRole("progressbar", { name: /chapter progress/iu }))
      .toBeInTheDocument();
  });
});
