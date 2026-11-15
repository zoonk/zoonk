// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { readAlignment, webCapture } from "./alignment-probe.mts";
import { ACTIONS, PIECES, SURFACES } from "./alignment-table.mts";
import { evaluateCapture } from "./alignment.mts";
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

const PIECE_SELECTORS = PIECES.flatMap((piece) =>
  piece.web ? [{ name: piece.name, web: piece.web }] : [],
);

function read() {
  return webCapture({
    page: readAlignment({ actions: ACTIONS, pieces: PIECE_SELECTORS, surfaces: SURFACES }),
    path: "/fixture",
    scheme: "light",
    viewport: "phone",
  });
}

/** What the document shows at a point: one element everywhere, or one per point. */
let hit: Element | null | ((x: number, y: number) => Element | null) = null;

beforeEach(() => {
  installPageHelpers();

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
      getImageData: () => ({ data: [0, 0, 0, 0] }),
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
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  hit = null;
});

const row = (label: string, y: number, x = 0) =>
  `<div data-box="0,${y},300,30"><span data-slot="list-row-title" data-box="${x},${y + 5},100,20">${label}</span></div>`;

function save(attributes: string) {
  return `<button type="submit" style="--button-variant: default" data-box="0,0,100,40" ${attributes}>Save</button>`;
}

function link(text: string, href: string, y: number) {
  return `<a href="${href}" style="--button-variant: default" data-box="0,${y},100,40">${text}</a>`;
}

/** An earlier dialog over part of a later one: each one's own middle shows itself. */
const OVERLAPPING = `
  <div role="dialog" aria-modal="true" aria-label="Top" data-box="0,0,200,100">
    <button style="--button-variant: default" data-box="0,0,100,40">Top A</button>
    <button style="--button-variant: default" data-box="0,50,100,40">Top B</button>
  </div>
  <div role="dialog" aria-modal="true" aria-label="Under" data-box="100,0,400,300">
    <button style="--button-variant: default" data-box="300,200,100,40">Under</button>
  </div>`;

describe("reading a declared piece in the page", () => {
  it("reads rows through a display-contents wrapper, so their fault still fails", () => {
    document.body.innerHTML = `<div data-slot="list-group" data-box="0,0,300,60">
      <div style="display: contents">${row("A", 0)}${row("B", 30, 28)}</div></div>`;

    const fault = evaluateCapture(read()).find((finding) => finding.level === "fail");

    assert.equal(fault?.rule, "label-start");
    assert.equal(fault?.measured, 28);
  });

  it("reads a group with no height of its own by the rows it draws, and leaves out one drawing nothing", () => {
    document.body.innerHTML = `<div data-slot="list-group" data-box="0,0,300,0">
      ${row("A", 0)}${row("B", 30, 28)}</div><div data-slot="list-group" data-box="0,100,300,0"></div>`;

    const capture = read();
    const fault = evaluateCapture(capture).find((finding) => finding.rule === "label-start");

    assert.equal(fault?.measured, 28);
    assert.equal(capture.elements.filter((element) => element.part === "group").length, 1);
  });

  it("writes a scaled group as not measured instead of comparing its drawn rows with unscaled gaps", () => {
    document.body.innerHTML = `<div data-slot="list-group" data-box="0,0,600,152" data-layout="300,76"
      style="display: flex; flex-direction: column; row-gap: 8px">${row("A", 0)}${row("B", 46)}</div>`;

    const findings = evaluateCapture(read());

    assert.deepEqual(
      findings.map((finding) => `${finding.level} ${finding.rule}`),
      ["not-measured scale"],
    );
  });

  it("keeps what it measured, so labels 1.04 apart fail the 1 px edge", () => {
    document.body.innerHTML = `<div data-slot="list-group" data-box="0,0,300,60">
      ${row("A", 0, 8)}${row("B", 30, 9.04)}</div>`;

    const fault = evaluateCapture(read()).find((finding) => finding.rule === "label-start");

    assert.match(fault?.detail ?? "", /"B" at 9 where 1 of 2 start at 8/u);
    assert.equal(fault?.measured, 1.04);
  });

  it("keeps a declared group whose rows carry no parts, so it reads as not measured", () => {
    document.body.innerHTML = `<div data-slot="list-group" data-box="0,0,300,60">
      <div data-box="0,0,300,30">A</div><div data-box="0,30,300,30">B</div></div>`;

    const [record] = evaluateCapture(read());

    assert.equal(record?.level, "not-measured");
    assert.equal(record?.rule, "label");
  });

  it("counts filled actions on the surface the document shows on top, not the last one in order", () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true" aria-label="Top" data-box="0,0,300,300">
        <button style="--button-variant: default" data-box="0,0,100,40">Top A</button>
        <button style="--button-variant: default" data-box="0,50,100,40">Top B</button>
      </div>
      <div role="dialog" aria-modal="true" aria-label="Under" data-box="0,0,300,300">
        <button style="--button-variant: default" data-box="0,100,100,40">Under</button>
      </div>`;

    hit = document.querySelector("[aria-label=Top] button");
    const [fault] = evaluateCapture(read());

    assert.equal(fault?.rule, "one-filled");
    assert.match(fault?.detail ?? "", /"Top A", "Top B"/u);
  });

  it("asks which of two partly overlapping surfaces is on top where they overlap", () => {
    document.body.innerHTML = OVERLAPPING;
    const top = document.querySelector("[aria-label=Top] button");
    const under = document.querySelector("[aria-label=Under] button");

    // Each surface's own middle shows itself; where they overlap, the earlier one is on top.
    hit = (x) => (x < 200 ? top : under);
    const [fault] = evaluateCapture(read());

    assert.equal(fault?.rule, "one-filled");
    assert.match(fault?.detail ?? "", /"Top A", "Top B"/u);
  });

  it("fails one-filled as not measured when the document can't say which surface is on top", () => {
    document.body.innerHTML = OVERLAPPING;
    const top = document.querySelector("[aria-label=Top] button");
    const under = document.querySelector("[aria-label=Under] button");

    hit = (x) => {
      if (x === 150) {
        return document.body;
      }

      return x < 200 ? top : under;
    };

    const [record] = evaluateCapture(read());

    assert.equal(record?.level, "not-measured");
    assert.equal(record?.rule, "one-filled");
  });

  it("counts each submit button, unless its piece names one action drawn twice", () => {
    // Two destinations from one form, and two forms that send the same place different records.
    document.body.innerHTML = `<form action="/same">${save('formaction="/approve"')}${save('formaction="/reject"')}</form>`;
    assert.equal(evaluateCapture(read())[0]?.rule, "one-filled");

    document.body.innerHTML = `<form action="/update">${save("")}</form><form action="/update">${save("")}</form>`;
    assert.equal(evaluateCapture(read())[0]?.rule, "one-filled");

    // The landing page's goal box, drawn at its top and its end.
    document.body.innerHTML = `<form action="/start">${save('data-action-name="build-plan"')}</form>
      <form action="/start">${save('data-action-name="build-plan"')}</form>`;

    assert.deepEqual(evaluateCapture(read()), []);
  });

  it("counts a link to the same place with the same words once, and two different ones twice", () => {
    document.body.innerHTML =
      link("Build my plan", "/start", 0) + link("Build my plan", "/start", 900);

    assert.deepEqual(evaluateCapture(read()), []);

    document.body.innerHTML =
      link("Build my plan", "/start", 0) + link("See pricing", "/pricing", 900);

    assert.equal(evaluateCapture(read())[0]?.rule, "one-filled");
  });
});
