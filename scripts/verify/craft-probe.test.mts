// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { readCraft } from "./craft-probe.mts";

function box(element: Element) {
  const [left = 0, top = 0, width = 100, height = 40] = (
    element instanceof HTMLElement ? (element.dataset.box ?? "") : ""
  )
    .split(",")
    .map(Number);

  return new DOMRect(left, top, width, height);
}

beforeEach(() => {
  // jsdom has no layout or canvas; the fixture supplies measured boxes and painted colors.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function measuredBox(
    this: Element,
  ) {
    return box(this);
  });

  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: () => true,
  });

  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get(this: HTMLElement) {
      return this.textContent;
    },
  });

  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: 1024,
  });

  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 800,
  });

  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value(this: Range) {
      const element = this.commonAncestorContainer.parentElement;
      return element ? [box(element)] : [];
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "",
      getImageData(this: { fillStyle: string }) {
        const channels = this.fillStyle.match(/[\d.]+/gu)?.map(Number) ?? [];
        const [red = 0, green = 0, blue = 0, alpha = 1] = channels;
        return { data: [red, green, blue, alpha * 255] };
      },
      measureText: () => ({ actualBoundingBoxLeft: 0, actualBoundingBoxRight: 8, width: 8 }),
    }),
  });

  document.body.style.backgroundColor = "white";
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("craft page measurements", () => {
  it("reads a control's drawn box, corner and text rather than accepting an empty page", () => {
    document.body.innerHTML = `<button aria-label="Continue" data-box="16,24,120,44"
      style="background:black;color:white;border-radius:8px;font-size:16px">Continue</button>`;

    const facts = readCraft();

    assert.deepEqual(facts.controls, [
      {
        bottom: 68,
        height: 44,
        kind: "button",
        label: '"Continue"',
        left: 16,
        radius: 8,
        right: 136,
        top: 24,
        width: 120,
      },
    ]);

    assert.equal(facts.texts[0]?.size, 16);

    assert.equal(
      facts.ink.some((ink) => ink.kind === "text" && ink.left === 16 && ink.top === 24),
      true,
    );

    assert.equal(
      facts.ink.some((ink) => ink.kind === "box" && ink.control),
      true,
    );
  });

  it("reads the gaps a stack actually draws and leaves hidden measurements out", () => {
    document.body.innerHTML = `<ul aria-label="Choices" data-box="16,0,200,160">
      <li data-box="16,0,200,40">One</li><li data-box="16,48,200,40">Two</li>
      <li data-box="16,104,200,40">Three</li></ul>
      <button data-box="0,0,0,0">Hidden</button>`;

    const facts = readCraft();
    assert.deepEqual(facts.gaps, [{ distributed: false, gaps: [8, 16], label: '"Choices"' }]);

    assert.equal(
      facts.ink.some((ink) => ink.label === '"Hidden"'),
      false,
    );
  });
});
