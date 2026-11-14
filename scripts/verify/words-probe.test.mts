// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { placeFindings, readWords, summarizeWords } from "./words.mts";

const CONTROL_HEIGHT = 44;
const BAR_HEIGHT = 65;
const TITLE_TOP = 101;
const HEADER_TOP = 4;
const PAGE_TOP = { bar: "sample-bar", header: "sample-header", row: "sample-row" };

function value(this: HTMLElement) {
  return !this.hidden;
}

beforeEach(() => {
  // jsdom supplies the tree and styles; these boxes stand in for browser layout.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function box(
    this: HTMLElement,
  ) {
    return new DOMRect(
      0,
      Number(this.dataset.top ?? 0),
      100,
      this.classList.contains(PAGE_TOP.bar) ? BAR_HEIGHT : CONTROL_HEIGHT,
    );
  });

  Object.defineProperty(Element.prototype, "checkVisibility", { configurable: true, value });

  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get(this: HTMLElement) {
      return this.textContent;
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function action({
  bar = "bottom-bar",
  enter = "bound",
  pinned = true,
}: { bar?: string; enter?: string; pinned?: boolean } = {}) {
  const top = innerHeight - CONTROL_HEIGHT;

  document.body.innerHTML = `<section data-slot="task-frame">
    <main><h1>A question</h1><button class="group/button bg-primary">An ordinary button</button></main>
    <footer data-slot="${bar}" data-top="${top}" style="position:${pinned ? "fixed" : "static"}">
      <button data-enter="${enter}" data-top="${top}">Continue</button>
    </footer></section>`;

  return readWords(null);
}

describe("reading the one main action", () => {
  it("uses its hook and finds the task's footer beside the main region", () => {
    const words = action();
    assert.equal(words.action, "Continue");
    assert.equal(words.actionPinned, true);
    assert.deepEqual(placeFindings(summarizeWords(words, "app")), []);
  });

  it("reports one fault for a missing canonical bar or an unpinned action", () => {
    for (const words of [
      action({ bar: "footer" }),
      action({ bar: "task-action-bar" }),
      action({ pinned: false }),
    ]) {
      assert.equal(words.actionPinned, false);
      assert.equal(placeFindings(summarizeWords(words, "app")).length, 1);
    }
  });

  it("recognizes host-bound and deliberately unbound actions, including a disabled one", () => {
    for (const enter of ["host", "off"]) {
      action({ enter });
      document.querySelector("[data-enter]")?.setAttribute("disabled", "");
      assert.equal(readWords(null).actionPinned, true);
    }
  });

  it("does not call a normal filled button or two actions the one main action", () => {
    action();
    delete document.querySelector<HTMLElement>("[data-enter]")?.dataset.enter;
    assert.equal(readWords(null).actionPinned, null);
    assert.equal(readWords(null).action, null);
    action();

    document
      .querySelector("main")
      ?.insertAdjacentHTML("beforeend", '<button data-enter="host">Save</button>');

    assert.equal(readWords(null).actionPinned, null);
  });
});

describe("reading an app title's top", () => {
  it("reads a 101 px title offset rather than comparing two equally wrong screens", () => {
    document.body.innerHTML = `<style>.sample-header { padding-top: 4px; border-top-width: 0px; }</style>
      <section data-slot="learn-shell-content"><main><h1 data-top="${TITLE_TOP}">Today</h1></main></section>`;

    assert.deepEqual(readWords(PAGE_TOP).titleTop, {
      actual: TITLE_TOP,
      expected: BAR_HEIGHT + HEADER_TOP,
    });
  });

  it("leaves task and onboarding tops to their own frames", () => {
    for (const frame of ["task-frame", "onboarding-frame"]) {
      document.body.innerHTML = `<section data-slot="learn-shell-content"><div data-slot="${frame}">
        <main><h1 data-top="${TITLE_TOP}">A question</h1></main></div></section>`;

      assert.equal(readWords(PAGE_TOP).titleTop, null);
    }
  });
});
