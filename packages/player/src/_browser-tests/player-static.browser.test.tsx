import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cdp, page } from "vitest/browser";
import { runInTabletLandscapePlayerViewport } from "../_test-utils/browser-viewport";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import { buildSerializedLesson, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

type CdpClient = { send: (method: string, params?: unknown) => Promise<unknown> };

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

/**
 * CDP touch emulation lets this browser test recreate a real landscape tablet:
 * the viewport has large-screen width, but CSS still evaluates
 * `(pointer: coarse)` like it does on touch-first hardware.
 */
async function emulatePointer(pointer: "coarse" | null) {
  const client = cdp() as CdpClient;

  if (pointer === "coarse") {
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    return;
  }

  await client.send("Emulation.setTouchEmulationEnabled", { enabled: false });
}

/**
 * Resets emulated pointer behavior after a targeted pointer test so later browser
 * tests continue to run with the provider's default desktop environment.
 */
async function runWithPointerMedia({
  pointer,
  run,
}: {
  pointer: "coarse";
  run: () => Promise<void>;
}) {
  await emulatePointer(pointer);

  try {
    await run();
  } finally {
    await emulatePointer(null);
  }
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
 * Rich text renders plain text inside inline spans, while the visual collision
 * risk belongs to the block-level paragraph. Measuring the nearest paragraph
 * keeps the regression focused on the readable copy box the learner sees.
 */
function getMeasuredTextBlock(element: HTMLElement) {
  return element.closest("p") ?? element;
}

/**
 * Desktop side arrows are allowed to float above empty stage space, but they
 * should never cover readable lesson copy. A small gap gives the focus ring and
 * touch target room without forcing tablet users back to the bottom bar.
 */
function expectHorizontalGap({
  firstElement,
  secondElement,
}: {
  firstElement: HTMLElement;
  secondElement: HTMLElement;
}) {
  const firstRect = firstElement.getBoundingClientRect();
  const secondRect = secondElement.getBoundingClientRect();

  expect(secondRect.left).toBeGreaterThanOrEqual(firstRect.right + 8);
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
  it("shows explicit navigation controls while preserving keyboard navigation", async () => {
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
    await expect.element(page.getByRole("button", { name: /^Previous$/u })).not.toBeInTheDocument();

    await page.getByRole("button", { name: /^Next$/u }).click();
    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    await page.getByRole("button", { name: /^Previous$/u }).click();
    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("status")).toBeInTheDocument();

    await page.getByRole("button", { name: /try again/iu }).click();
    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();
  });

  it("shows tappable mobile navigation controls on static steps", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: { text: "First body", title: "First step", variant: "text" as const },
            id: "static-mobile-nav-1",
          }),
          buildSerializedStep({
            content: { text: "Second body", title: "Second step", variant: "text" as const },
            id: "static-mobile-nav-2",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /^Previous$/u })).not.toBeInTheDocument();

    await page.getByRole("button", { name: /^Next$/u }).click();

    await expect.element(page.getByRole("heading", { name: "Second step" })).toBeInTheDocument();

    await page.getByRole("button", { name: /^Previous$/u }).click();

    await expect.element(page.getByRole("heading", { name: "First step" })).toBeInTheDocument();
  });

  it("shows arrow navigation on landscape tablets", async () => {
    await runInTabletLandscapePlayerViewport(async () => {
      await runWithPointerMedia({
        pointer: "coarse",
        run: async () => {
          expect(globalThis.matchMedia("(pointer: coarse)").matches).toBe(true);

          renderPlayer({
            lesson: buildSerializedLesson({
              kind: "explanation",
              steps: [
                buildSerializedStep({
                  content: { text: "First body", title: "First step", variant: "text" as const },
                  id: "static-tablet-landscape-1",
                }),
                buildSerializedStep({
                  content: { text: "Second body", title: "Second step", variant: "text" as const },
                  id: "static-tablet-landscape-2",
                  position: 1,
                }),
              ],
            }),
            navigation: buildNavigation({ nextLessonHref: null }),
            viewer: buildAuthenticatedViewer(),
          });

          await expect
            .element(page.getByRole("heading", { name: "First step" }))
            .toBeInTheDocument();

          await page.getByRole("button", { name: /^Next step$/u }).click();

          await expect
            .element(page.getByRole("heading", { name: "Second step" }))
            .toBeInTheDocument();

          await page.getByRole("button", { name: /^Previous step$/u }).click();

          await expect
            .element(page.getByRole("heading", { name: "First step" }))
            .toBeInTheDocument();
        },
      });
    });
  });

  it("keeps landscape tablet arrows outside image-backed static copy", async () => {
    await runInTabletLandscapePlayerViewport(async () => {
      renderPlayer({
        lesson: buildSerializedLesson({
          kind: "explanation",
          steps: [
            buildSerializedStep({
              content: {
                image: {
                  prompt: "A tablet-safe static explanation image",
                  url: buildInlineImageUrl({ label: "A tablet-safe static explanation image" }),
                },
                text: "This copy intentionally sits in the media column on a landscape tablet, where the next arrow used to cover the readable paragraph.",
                title: "Tablet explanation",
                variant: "text" as const,
              },
              id: "static-tablet-copy-safe",
            }),
          ],
        }),
        navigation: buildNavigation({ nextLessonHref: null }),
        viewer: buildAuthenticatedViewer(),
      });

      await expect
        .element(page.getByRole("heading", { name: "Tablet explanation" }))
        .toBeInTheDocument();

      const copy = getMeasuredTextBlock(
        screen.getByText(/next arrow used to cover the readable paragraph/u),
      );

      expectHorizontalGap({
        firstElement: copy,
        secondElement: screen.getByRole("button", { name: /^Next step$/u }),
      });
    });
  });

  it("renders grammar example static variants through the shared shell", async () => {
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
              text: "Add -ed to regular verbs",
              title: "Past tense",
              variant: "text" as const,
            },
            id: "static-rule-explanation",
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

  it("splits leading grammar explanation sentences into separate player lines", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "grammar",
        steps: [
          buildSerializedStep({
            content: {
              text: "Use el for masculine nouns. Use la for feminine nouns, e.g. la mesa. This changes the article.",
              title: "Articles",
              variant: "text" as const,
            },
            id: "grammar-explanation",
          }),
          buildSerializedStep({
            content: {
              highlight: "la",
              romanization: null,
              sentence: "La mesa es grande",
              translation: "The table is big",
              variant: "grammarExample" as const,
            },
            id: "grammar-example",
            position: 1,
          }),
          buildSerializedStep({
            content: {
              text: "Keep this later note together. It is no longer part of the opening explanation.",
              title: "Later note",
              variant: "text" as const,
            },
            id: "later-static-note",
            position: 2,
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("heading", { name: "Articles" })).toBeInTheDocument();
    expect(screen.getByText("Use el for masculine nouns.")).toBeInTheDocument();
    expect(screen.getByText("Use la for feminine nouns, e.g. la mesa.")).toBeInTheDocument();
    expect(screen.getByText("This changes the article.")).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });

    await expect.element(page.getByRole("heading", { name: "Later note" })).toBeInTheDocument();

    expect(
      screen.getByText(
        "Keep this later note together. It is no longer part of the opening explanation.",
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText("Keep this later note together.")).not.toBeInTheDocument();
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

  it("renders over-escaped generated LaTeX as math", async () => {
    const { container } = renderPlayer({
      lesson: buildSerializedLesson({
        kind: "explanation",
        steps: [
          buildSerializedStep({
            content: {
              text: String.raw`A forma básica é: estado atual + ação → próximo estado esperado. Em notação curta: \\(s, a \\rightarrow s'\\), onde \\(s\\) é o estado.`,
              title: "A seta da previsão",
              variant: "text" as const,
            },
            id: "static-over-escaped-latex",
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("heading", { name: "A seta da previsão" }))
      .toBeInTheDocument();

    const bodyText = container.textContent?.replaceAll(/\s/gu, "");

    expect(bodyText).toContain("s,a→s");
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

    expect(
      globalThis.getComputedStyle(screen.getByAltText(/lantern lighting up one idea at a time/iu))
        .objectFit,
    ).toBe("contain");
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
