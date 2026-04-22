import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

function buildTouch({
  identifier,
  target,
  x,
  y,
}: {
  identifier: number;
  target: EventTarget;
  x: number;
  y: number;
}) {
  return new Touch({
    clientX: x,
    clientY: y,
    identifier,
    target,
  });
}

function swipeLeft(target: HTMLElement) {
  const startTouch = buildTouch({ identifier: 1, target, x: 320, y: 220 });
  const endTouch = buildTouch({ identifier: 1, target, x: 120, y: 210 });

  fireEvent.touchStart(target, {
    changedTouches: [startTouch],
    targetTouches: [startTouch],
    touches: [startTouch],
  });
  fireEvent.touchEnd(globalThis.window, {
    changedTouches: [endTouch],
    touches: [],
  });
}

function tapLeft(target: HTMLElement) {
  const touch = buildTouch({ identifier: 2, target, x: 24, y: 220 });

  fireEvent.touchStart(target, {
    changedTouches: [touch],
    targetTouches: [touch],
    touches: [touch],
  });
  fireEvent.touchEnd(globalThis.window, {
    changedTouches: [touch],
    touches: [],
  });
}

function tapRight(target: HTMLElement) {
  const touch = buildTouch({ identifier: 3, target, x: 320, y: 220 });

  fireEvent.touchStart(target, {
    changedTouches: [touch],
    targetTouches: [touch],
    touches: [touch],
  });
  fireEvent.touchEnd(globalThis.window, {
    changedTouches: [touch],
    touches: [],
  });
}

describe("player browser integration: static steps", () => {
  test("uses keyboard navigation without visible step arrows", async () => {
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
    await expect.element(page.getByRole("button", { name: /next step/i })).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: /previous step/i }))
      .not.toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
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

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });

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
                url: buildInlineImageUrl({ label: "A lantern lighting up one idea at a time" }),
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

  test("swipes touch navigation forward on static steps", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: {
              image: {
                prompt: "A lantern lighting up one idea at a time",
                url: buildInlineImageUrl({ label: "A lantern lighting up one idea at a time" }),
              },
              text: "An image can now live inside the same readable step.",
              title: "One step, one image",
              variant: "text" as const,
            },
            id: "swipe-static-image",
          }),
          buildSerializedStep({
            content: { text: "Second body", title: "Second step", variant: "text" as const },
            id: "swipe-static-second",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextActivityHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    swipeLeft(screen.getByAltText(/lantern lighting up one idea at a time/i));

    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();
  });

  test("uses single taps on the left and right halves for touch navigation", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: {
              image: {
                prompt: "A lantern lighting up one idea at a time",
                url: buildInlineImageUrl({ label: "A lantern lighting up one idea at a time" }),
              },
              text: "An image can now live inside the same readable step.",
              title: "One step, one image",
              variant: "text" as const,
            },
            id: "tap-static-image",
          }),
          buildSerializedStep({
            content: { text: "Second body", title: "Second step", variant: "text" as const },
            id: "tap-static-second",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextActivityHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    tapRight(screen.getByAltText(/lantern lighting up one idea at a time/i));
    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    tapLeft(screen.getByRole("heading", { name: "Second step" }));
    await expect
      .element(page.getByRole("heading", { name: "One step, one image" }))
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
