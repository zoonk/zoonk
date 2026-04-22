import { fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: static steps", () => {
  test("navigates static steps and restarts from the completion screen", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: { text: "First body", title: "First step", variant: "text" as const },
            id: "static-1",
          }),
          buildSerializedStep({
            content: { text: "Second body", title: "Second step", variant: "text" as const },
            id: "static-2",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextActivityHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();

    await page.getByRole("button", { name: /next step/i }).click();
    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    await page.getByRole("button", { name: /next step/i }).click();
    await expect.element(page.getByRole("status")).toBeInTheDocument();

    await page.getByRole("button", { name: /try again/i }).click();
    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();
  });

  test("renders grammar example and grammar rule static variants through the shared shell", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: {
              highlight: "corre",
              romanization: "ko-rre",
              sentence: "Ella corre rapido",
              translation: "She runs fast",
              variant: "grammarExample" as const,
            },
            id: "static-grammar-example",
          }),
          buildSerializedStep({
            content: {
              ruleName: "Past tense",
              ruleSummary: "Add -ed to regular verbs",
              variant: "grammarRule" as const,
            },
            id: "static-grammar-rule",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextActivityHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText(/Ella.*corre.*rapido/i)).toBeInTheDocument();
    await expect.element(page.getByText("ko-rre")).toBeInTheDocument();
    await expect.element(page.getByText("She runs fast")).toBeInTheDocument();

    await page.getByRole("button", { name: /next step/i }).click();

    await expect.element(page.getByRole("heading", { name: "Past tense" })).toBeInTheDocument();
    await expect.element(page.getByText("Add -ed to regular verbs")).toBeInTheDocument();
  });

  test("renders embedded step images inside the shared static shell", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: {
              image: {
                prompt: "A lantern lighting up one idea at a time",
                url: "https://example.com/lantern.webp",
              },
              text: "An image can now live inside the same readable step.",
              title: "One step, one image",
              variant: "text" as const,
            },
            id: "static-image",
          }),
        ],
      }),
      navigation: buildNavigation({ nextActivityHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("heading", { name: "One step, one image" }))
      .toBeInTheDocument();
    await expect
      .element(page.getByAltText(/lantern lighting up one idea at a time/i))
      .toBeInTheDocument();
  });

  test("supports keyboard navigation on static steps and keyboard completion actions", async () => {
    const onEscape = vi.fn();

    renderPlayer({
      activity: buildSerializedActivity({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: { text: "First body", title: "First step", variant: "text" as const },
            id: "static-keyboard-1",
          }),
          buildSerializedStep({
            content: { text: "Second body", title: "Second step", variant: "text" as const },
            id: "static-keyboard-2",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextActivityHref: null }),
      onEscape,
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowLeft" });
    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("status")).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "r" });
    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    fireEvent.keyDown(globalThis.window, { key: "Enter" });

    expect(onEscape).toHaveBeenCalledOnce();
  });
});
