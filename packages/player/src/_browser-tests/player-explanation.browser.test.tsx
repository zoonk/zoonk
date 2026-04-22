import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: explanation activity flow", () => {
  test("handles title-only hooks, body-only explanations, step images, and predict checks in one flow", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: {
              image: {
                prompt: "A wrapped network packet moving through layered labels",
                url: buildInlineImageUrl({
                  label: "A wrapped network packet moving through layered labels",
                }),
              },
              text: "",
              title: "Why doesn't the whole message travel as one blob?",
              variant: "text" as const,
            },
            id: "hook-question",
          }),
          buildSerializedStep({
            content: {
              image: {
                prompt: "Different network layers adding their own labels to the same payload",
                url: buildInlineImageUrl({
                  label: "Different network layers adding their own labels to the same payload",
                }),
              },
              text: "Each layer adds its own label so the next part of the network knows what job to do.",
              title: "",
              variant: "text" as const,
            },
            id: "hook-explanation",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              kind: "core",
              options: [
                {
                  feedback: "Right. That label helps the network forward it.",
                  isCorrect: true,
                  text: "A routing label",
                },
                {
                  feedback: "Not this one. The message still needs routing information.",
                  isCorrect: false,
                  text: "A random color tag",
                },
              ],
              question: "Which label helps the network decide where to send the packet next?",
            },
            id: "predict-check",
            kind: "multipleChoice",
            position: 2,
          }),
          buildSerializedStep({
            content: {
              image: {
                prompt:
                  "A message reaching its destination after moving through several network hops",
                url: buildInlineImageUrl({
                  label:
                    "A message reaching its destination after moving through several network hops",
                }),
              },
              text: "This is why apps like WhatsApp can send one message through many network hops without each hop needing the whole chat history.",
              title: "This is why",
              variant: "text" as const,
            },
            id: "anchor-step",
            position: 3,
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(
        page.getByRole("heading", {
          name: /whole message travel as one blob/i,
        }),
      )
      .toBeInTheDocument();
    await expect
      .element(page.getByAltText(/wrapped network packet moving through layered labels/i))
      .toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByText(/each layer adds its own label/i)).toBeInTheDocument();
    await expect
      .element(page.getByAltText(/different network layers adding their own labels/i))
      .toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect
      .element(
        page.getByText(/which label helps the network decide where to send the packet next/i),
      )
      .toBeInTheDocument();

    await page.getByRole("radio", { name: /routing label/i }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect.element(page.getByRole("heading", { name: "This is why" })).toBeInTheDocument();
    await expect.element(page.getByText(/whatsapp/i)).toBeInTheDocument();
    await expect
      .element(
        page.getByAltText(
          /message reaching its destination after moving through several network hops/i,
        ),
      )
      .toBeInTheDocument();
  });
});
