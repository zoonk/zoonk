import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import { buildSerializedLesson, buildSerializedStep } from "../_test-utils/player-test-data";
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
  return new Touch({ clientX: x, clientY: y, identifier, target });
}

function swipeLeft(target: HTMLElement) {
  const startTouch = buildTouch({ identifier: 1, target, x: 320, y: 220 });
  const endTouch = buildTouch({ identifier: 1, target, x: 120, y: 210 });

  fireEvent.touchStart(target, {
    changedTouches: [startTouch],
    targetTouches: [startTouch],
    touches: [startTouch],
  });

  fireEvent.touchEnd(globalThis.window, { changedTouches: [endTouch], touches: [] });
}

/**
 * Exercises the intentional backward gesture without relying on browser-level
 * swipe synthesis, which is not available inside the package browser harness.
 */
function swipeRight(target: HTMLElement) {
  const startTouch = buildTouch({ identifier: 4, target, x: 120, y: 220 });
  const endTouch = buildTouch({ identifier: 4, target, x: 320, y: 210 });

  fireEvent.touchStart(target, {
    changedTouches: [startTouch],
    targetTouches: [startTouch],
    touches: [startTouch],
  });

  fireEvent.touchEnd(globalThis.window, { changedTouches: [endTouch], touches: [] });
}

function tapLeft(target: HTMLElement) {
  const touch = buildTouch({ identifier: 2, target, x: 24, y: 220 });

  fireEvent.touchStart(target, {
    changedTouches: [touch],
    targetTouches: [touch],
    touches: [touch],
  });

  fireEvent.touchEnd(globalThis.window, { changedTouches: [touch], touches: [] });
}

function tapRight(target: HTMLElement) {
  const touch = buildTouch({ identifier: 3, target, x: 320, y: 220 });

  fireEvent.touchStart(target, {
    changedTouches: [touch],
    targetTouches: [touch],
    touches: [touch],
  });

  fireEvent.touchEnd(globalThis.window, { changedTouches: [touch], touches: [] });
}

/**
 * Restores the real viewport object after a test forces a pinch-zoom scale.
 * Browser runners expose this as a global read-only-ish object, so preserving
 * the descriptor avoids leaking one test's zoom state into later tests.
 */
function restoreVisualViewport(descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, "visualViewport", descriptor);
    return;
  }

  delete (globalThis as { visualViewport?: VisualViewport }).visualViewport;
}

/**
 * Forces `visualViewport.scale` so the gesture contract can be verified without
 * depending on real mobile pinch gestures in the desktop browser runner.
 */
async function runWithViewportScale({ run, scale }: { run: () => Promise<void>; scale: number }) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "visualViewport");

  Object.defineProperty(globalThis, "visualViewport", { configurable: true, value: { scale } });

  try {
    await run();
  } finally {
    restoreVisualViewport(descriptor);
  }
}

function buildLongStaticText() {
  return [
    ...Array.from(
      { length: 32 },
      (_, index) =>
        `Scrollable paragraph ${index + 1} explains a detail that makes this static step taller than the player viewport.`,
    ),
    "Bottom sentence should stay reachable after scrolling.",
  ].join(" ");
}

/**
 * Long static copy should not rely on the page body to scroll because the
 * player shell owns the viewport. This finds the nearest element that can
 * actually scroll the semantic content the learner is trying to read.
 */
function getScrollableAncestor(element: HTMLElement | null): HTMLElement | null {
  const parent = element?.parentElement;

  if (!parent) {
    return null;
  }

  const overflowY = globalThis.getComputedStyle(parent).overflowY;
  const canScrollVertically = parent.scrollHeight > parent.clientHeight;
  const allowsVerticalScroll = overflowY === "auto" || overflowY === "scroll";

  if (canScrollVertically && allowsVerticalScroll) {
    return parent;
  }

  return getScrollableAncestor(parent);
}

describe("player browser integration: static steps", () => {
  it("shows desktop arrows while preserving keyboard navigation", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
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
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();

    await expect
      .element(page.getByRole("button", { name: /previous step/iu }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: /next step/iu }).click();
    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    await page.getByRole("button", { name: /previous step/iu }).click();
    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("status")).toBeInTheDocument();

    await page.getByRole("button", { name: /try again/iu }).click();
    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();
  });

  it("renders grammar example and grammar rule static variants through the shared shell", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
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
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText(/Ella.*corre.*rapido/iu)).toBeInTheDocument();
    await expect.element(page.getByText("ko-rre")).toBeInTheDocument();
    await expect.element(page.getByText("She runs fast")).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });

    await expect.element(page.getByRole("heading", { name: "Past tense" })).toBeInTheDocument();
    await expect.element(page.getByText("Add -ed to regular verbs")).toBeInTheDocument();
  });

  it("renders generated rich text without exposing LaTeX delimiters", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: {
              text: "{{NAME}}, a regra é \\(d\\sin\\theta = m\\lambda\\). Use **destaque**, *ênfase* e `greetUser();`.",
              title: "A equação",
              variant: "text" as const,
            },
            id: "static-rich-text",
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("heading", { name: "A equação" })).toBeInTheDocument();
    await expect.element(page.getByText("destaque")).toBeInTheDocument();
    await expect.element(page.getByText("ênfase")).toBeInTheDocument();

    const boldText = screen.getByText("destaque");
    const italicText = screen.getByText("ênfase");
    const codeText = screen.getByText("greetUser();");
    const bodyText = screen.getByText(/Alex, a regra é/u).textContent;

    expect(boldText.tagName).toBe("STRONG");
    expect(italicText.tagName).toBe("EM");
    expect(codeText.tagName).toBe("CODE");
    expect(bodyText).not.toContain("{{NAME}}");
    expect(bodyText).not.toContain(String.raw`\(`);
    expect(bodyText).not.toContain(String.raw`\)`);
    expect(bodyText).not.toContain("`");
  });

  it("allows long text-only static steps to scroll to the bottom", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: {
              text: buildLongStaticText(),
              title: "Scrollable static step",
              variant: "text" as const,
            },
            id: "long-static-step",
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("heading", { name: "Scrollable static step" }))
      .toBeInTheDocument();

    const bottomSentence = screen.getByText(/Bottom sentence should stay reachable/u);
    const scrollContainer = getScrollableAncestor(bottomSentence);

    expect(scrollContainer).not.toBeNull();

    if (!scrollContainer) {
      throw new Error("Expected long static step to expose a scroll container");
    }

    scrollContainer.scrollTo({ top: scrollContainer.scrollHeight });

    expect(scrollContainer.scrollTop).toBeGreaterThan(0);

    expect(scrollContainer.scrollTop + scrollContainer.clientHeight).toBeGreaterThanOrEqual(
      scrollContainer.scrollHeight - 1,
    );
  });

  it("renders embedded step images inside the shared static shell", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
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
          buildSerializedStep({
            content: { text: "Second body", title: "Second step", variant: "text" as const },
            id: "static-image-second",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("heading", { name: "One step, one image" }))
      .toBeInTheDocument();

    await expect
      .element(page.getByAltText(/lantern lighting up one idea at a time/iu))
      .toBeInTheDocument();
  });

  it("swipes touch navigation forward on static steps", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
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
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    swipeLeft(screen.getByAltText(/lantern lighting up one idea at a time/iu));

    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();
  });

  it("uses swipes for touch navigation and ignores single taps", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
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
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    tapLeft(screen.getByAltText(/lantern lighting up one idea at a time/iu));

    await expect
      .element(page.getByRole("heading", { name: "One step, one image" }))
      .toBeInTheDocument();

    tapRight(screen.getByAltText(/lantern lighting up one idea at a time/iu));

    await expect
      .element(page.getByRole("heading", { name: "One step, one image" }))
      .toBeInTheDocument();

    swipeLeft(screen.getByAltText(/lantern lighting up one idea at a time/iu));

    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    tapLeft(screen.getByRole("heading", { name: "Second step" }));

    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    tapRight(screen.getByRole("heading", { name: "Second step" }));

    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    swipeRight(screen.getByRole("heading", { name: "Second step" }));

    await expect
      .element(page.getByRole("heading", { name: "One step, one image" }))
      .toBeInTheDocument();
  });

  it("ignores touch navigation while the viewport is zoomed", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
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
            id: "zoom-static-image",
          }),
          buildSerializedStep({
            content: { text: "Second body", title: "Second step", variant: "text" as const },
            id: "zoom-static-second",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await runWithViewportScale({
      run: async () => {
        swipeLeft(screen.getByAltText(/lantern lighting up one idea at a time/iu));

        await expect
          .element(page.getByRole("heading", { name: "One step, one image" }))
          .toBeInTheDocument();

        await expect
          .element(page.getByRole("heading", { name: "Second step" }))
          .not.toBeInTheDocument();
      },
      scale: 2,
    });
  });

  it("supports keyboard navigation on static steps and keyboard completion actions", async () => {
    const onEscape = vi.fn();

    renderPlayer({
      lesson: buildSerializedLesson({
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
      navigation: buildNavigation({ nextLessonHref: null }),
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
