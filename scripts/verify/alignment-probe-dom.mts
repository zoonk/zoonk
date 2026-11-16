/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import { afterEach, beforeEach, vi } from "vitest";
import { readAlignment, webCapture } from "./alignment-probe.mts";
import { WEB_TABLE } from "./alignment-table.mts";
import { installPageHelpers } from "./page-helpers.mts";

/** jsdom has no layout: each element's box comes from its `data-box` (x, y, width, height). */
function box(element: Element) {
  const [left = 0, top = 0, width = 0, height = 0] = (
    element instanceof HTMLElement ? (element.dataset.box ?? "") : ""
  )
    .split(",")
    .map(Number);

  return new DOMRect(left, top, width, height);
}

export function read() {
  return webCapture({
    app: "main",
    page: readAlignment(WEB_TABLE),
    path: "/fixture",
    scheme: "light",
    viewport: "phone",
  });
}

/** What the document shows at a point: one element everywhere, or one per point. */
type Hit = Element | null | ((x: number, y: number) => Element | null);

let hit: Hit = null;

export function setHit(value: Hit) {
  hit = value;
}

/** jsdom set up as a page the probe reads: boxes, fonts, a canvas, what shows at a point. */
export function setUpProbeDom() {
  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function measured(
      this: Element,
    ) {
      return box(this);
    });

    Object.defineProperty(Element.prototype, "checkVisibility", {
      configurable: true,
      value: () => true,
    });

    // An element's laid-out size, before a transform or zoom: its `data-layout`, or its box.
    for (const [property, index] of [
      ["offsetWidth", 0],
      ["offsetHeight", 1],
    ] as const) {
      Object.defineProperty(HTMLElement.prototype, property, {
        configurable: true,
        get(this: HTMLElement) {
          const layout = this.dataset.layout?.split(",").map(Number);
          const drawn = box(this);
          return layout?.[index] ?? (index === 0 ? drawn.width : drawn.height);
        },
      });
    }

    Object.defineProperty(HTMLElement.prototype, "innerText", {
      configurable: true,
      get(this: HTMLElement) {
        return this.textContent;
      },
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
        // The pixel the color last set draws: what the helpers read a computed color by.
        getImageData(this: { fillStyle: string }) {
          const [red = 0, green = 0, blue = 0, alpha = 1] = (
            /rgba?\((?<channels>[^)]+)\)/u.exec(this.fillStyle)?.groups?.channels ?? "0, 0, 0, 0"
          )
            .split(",")
            .map(Number);

          return { data: [red, green, blue, Math.round(alpha * 255)] };
        },
        measureText: () => ({
          actualBoundingBoxAscent: 10,
          fontBoundingBoxAscent: 15,
          fontBoundingBoxDescent: 5,
          width: 8,
        }),
      }),
    });

    Object.defineProperty(document, "fonts", { configurable: true, value: [] });

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: (x: number, y: number) => (typeof hit === "function" ? hit(x, y) : hit),
    });

    // After the mocks, so the helpers' canvas is the one that draws colors.
    installPageHelpers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
    hit = null;
  });
}
