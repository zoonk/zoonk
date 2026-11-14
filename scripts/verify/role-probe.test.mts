// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { installPageHelpers } from "./page-helpers.mts";
import { readRoleFacts, roleFindings } from "./role-checks.mts";

const CONTROL_HEIGHT = 44;

function value(this: HTMLElement) {
  return !this.hidden;
}

beforeEach(() => {
  installPageHelpers();
  const box = new DOMRect(0, 0, 100, CONTROL_HEIGHT);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(box);

  Object.defineProperty(Element.prototype, "checkVisibility", { configurable: true, value });

  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [box],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("reading the page's named roles", () => {
  it("counts the real subscription gate hook and ignores a hidden gate", () => {
    document.body.innerHTML = `<main><section data-slot="subscribe-gate"></section>
      <section data-slot="subscribe-gate"></section>
      <section data-slot="subscribe-gate" hidden></section></main>`;

    assert.equal(readRoleFacts().gates, 2);
    assert.equal(roleFindings(readRoleFacts())[0]?.check, "R4 one subscription gate");
  });

  it("requires drawn destination text rather than just an accessible name or icon", () => {
    document.body.innerHTML = `<a data-slot="back-link" aria-label="Back to Today"><svg>Back</svg></a>
      <a data-slot="back-link"><span>Today</span></a>
      <a data-slot="back-link"><span aria-hidden="true">Today</span></a>
      <a data-slot="back-link" hidden></a>`;

    assert.equal(readRoleFacts().backLinksWithoutText, 2);
    assert.equal(roleFindings(readRoleFacts())[0]?.check, "E8 named back link");
  });

  it("finds hand-drawn title eyebrows but accepts the shared hook and controls", () => {
    document.body.innerHTML = `<header><p>Your plan</p><h1>Today</h1></header>
      <header><div>From a div</div><h1>Today</h1></header>
      <header><p data-slot="eyebrow">Your plan</p><h1>Today</h1></header>
      <header><p><span data-slot="eyebrow">Your plan</span></p><h1>Today</h1></header>
      <header><p><button>Change goal</button></p><h1>Today</h1></header>
      <header><p hidden>Hidden</p><h1>Today</h1></header>`;

    assert.deepEqual(readRoleFacts().unmarkedEyebrows, ["Your plan", "From a div"]);
    assert.equal(roleFindings(readRoleFacts())[0]?.check, "R3 eyebrow piece");
  });
});
