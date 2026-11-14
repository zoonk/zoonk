// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { installPageHelpers } from "./page-helpers.mts";
import { pageTopComparisons } from "./page-top-comparisons.mts";
import { pageKind, placeFindings, readWords, summarizeWords, titleTopFindings } from "./words.mts";

const CONTROL_HEIGHT = 44;
const BAR_HEIGHT = 65;
const TALL_BAR_HEIGHT = 85;
const TITLE_TOP = 101;
const HEADER_TOP = 4;

function value(this: HTMLElement) {
  return !this.hidden;
}

beforeEach(() => {
  installPageHelpers();
  // jsdom supplies the tree and styles; these boxes stand in for browser layout.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function box(
    this: HTMLElement,
  ) {
    return new DOMRect(
      0,
      Number(this.dataset.top ?? 0),
      100,
      this.dataset.slot === "page-top-bar" ? BAR_HEIGHT : CONTROL_HEIGHT,
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
  document.documentElement.style.removeProperty("--primary");
});

function action({
  bar = "bottom-bar",
  enter = "bound",
  pinned = true,
}: { bar?: string; enter?: string; pinned?: boolean } = {}) {
  const top = innerHeight - CONTROL_HEIGHT;

  document.body.innerHTML = `<section data-slot="task-frame">
    <main><h1>A question</h1><button class="group/button bg-secondary">An ordinary button</button></main>
    <footer data-slot="${bar}" data-top="${top}" style="position:${pinned ? "fixed" : "static"}">
      <button data-enter="${enter}" data-top="${top}">Continue</button>
    </footer></section>`;

  return readWords();
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
      assert.equal(placeFindings(summarizeWords(words, "long-form")).length, 1);
    }
  });

  it("recognizes host-bound and deliberately unbound actions, including a disabled one", () => {
    for (const enter of ["host", "off"]) {
      action({ enter });
      document.querySelector("[data-enter]")?.setAttribute("disabled", "");
      assert.equal(readWords().actionPinned, true);
    }
  });

  it("does not call a normal filled button or two actions the one main action", () => {
    action();
    delete document.querySelector<HTMLElement>("[data-enter]")?.dataset.enter;
    assert.equal(readWords().actionPinned, null);
    assert.equal(readWords().action, null);
    action();

    document
      .querySelector("main")
      ?.insertAdjacentHTML("beforeend", '<button data-enter="host">Save</button>');

    assert.equal(readWords().actionPinned, null);
  });
});

describe("reading an app title's top", () => {
  it("reads a 101 px title offset rather than comparing two equally wrong screens", () => {
    document.body.innerHTML = `<section data-slot="learn-shell-content"><div data-slot="page-top-bar"></div><main><header data-slot="page-header" style="padding-top:4px"><h1 data-top="${TITLE_TOP}">Today</h1></header></main></section>`;

    assert.deepEqual(readWords().titleTop, {
      actual: TITLE_TOP,
      expected: BAR_HEIGHT + HEADER_TOP,
    });
  });

  it("measures shared tops on internal apps even on their root route", () => {
    document.body.innerHTML = `<main><div data-slot="page-top-bar"></div><header data-slot="page-header" style="padding-top:4px"><h1 data-top="${TITLE_TOP}">Tools</h1></header></main>`;

    for (const app of ["admin", "api", "evals", "mailbox"]) {
      const facts = summarizeWords(readWords(), pageKind(app, "/"));
      assert.equal(facts.kind, "app");
      assert.equal(facts.titleTop?.expected, BAR_HEIGHT + HEADER_TOP);
      assert.equal(titleTopFindings(facts).length, 1);
    }
  });

  it("reports a missing bar instead of skipping a title at 4 px on both sizes", () => {
    document.body.innerHTML = `<main><header data-slot="page-header" style="padding-top:4px"><h1 data-top="${HEADER_TOP}">Focus test</h1></header></main>`;
    const facts = summarizeWords(readWords(), "app");
    assert.deepEqual(facts.titleTop, { actual: HEADER_TOP, expected: null });
    assert.ok(titleTopFindings(facts)[0]?.message.includes("no visible shared page-top-bar"));
  });

  it("leaves a centered sign-in form without a page header unmeasured", () => {
    document.body.innerHTML =
      '<main><div data-slot="page-top-bar"></div><form><h1>Log in</h1></form></main>';

    assert.equal(readWords().titleTop, null);
  });

  it("leaves task and onboarding tops to their own frames", () => {
    for (const frame of ["task-frame", "onboarding-frame"]) {
      document.body.innerHTML = `<section data-slot="learn-shell-content"><div data-slot="${frame}">
        <main><h1 data-top="${TITLE_TOP}">A question</h1></main></div></section>`;

      assert.equal(readWords().titleTop, null);
    }
  });
});

describe("page tops across a run", () => {
  it("detects differing bars even when each title matches its own bar", () => {
    const loads = [BAR_HEIGHT, TALL_BAR_HEIGHT].map((height, index) => {
      document.body.innerHTML = `<main><div data-slot="page-top-bar"></div><header style="padding-top:4px"><h1 data-top="${height + HEADER_TOP}">Page</h1></header></main>`;

      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function measured(
        this: HTMLElement,
      ) {
        return new DOMRect(
          0,
          Number(this.dataset.top ?? 0),
          100,
          this.dataset.slot === "page-top-bar" ? height : CONTROL_HEIGHT,
        );
      });

      const words = summarizeWords(readWords(), "app");
      assert.deepEqual(titleTopFindings(words), []);
      return { path: `/page-${index}`, viewport: "phone", words };
    });

    assert.equal(pageTopComparisons(loads).length, 1);
    const first = loads[0];
    assert.ok(first);
    assert.deepEqual(pageTopComparisons([first, { ...first, viewport: "laptop" }]), []);
  });
});

describe("unregistered primary actions", () => {
  it("reports a filled action without an Enter binding and respects surface scope", () => {
    document.body.innerHTML =
      '<main><h1>Settings</h1><button class="bg-primary">Save</button></main>';

    const facts = summarizeWords(readWords(), "app");
    assert.equal(placeFindings(facts).length, 1);
    assert.deepEqual(placeFindings({ ...facts, kind: "marketing" }), []);

    for (const step of ["login", "otp", "setup"]) {
      assert.deepEqual(placeFindings(facts, { app: "api", path: `/auth/en/${step}` }), []);
    }

    assert.equal(placeFindings(facts, { app: "main", path: "/settings" }).length, 1);
    document.documentElement.style.setProperty("--primary", "rgb(20, 20, 20)");

    document.body.innerHTML =
      '<main><h1>Settings</h1><button style="background:rgb(20,20,20)">Save</button></main>';

    assert.equal(placeFindings(summarizeWords(readWords(), "app")).length, 1);
    assert.equal(pageKind("playground", "/design/buttons"), "marketing");

    document.body.innerHTML =
      '<div data-slot="public-page"><main><h1>Missing page</h1><a class="bg-primary" href="/">Go home</a></main></div>';

    const missing = summarizeWords(readWords(), pageKind("main", "/an-unknown-page"));
    assert.equal(missing.kind, "marketing");
    assert.deepEqual(placeFindings(missing), []);
    assert.equal(summarizeWords(readWords(), "long-form").kind, "long-form");
  });

  it("excludes filled actions inside bars, overlays, notices and suggestions", () => {
    document.body.innerHTML =
      '<main><h1>Settings</h1><footer data-slot="bottom-bar"><button class="bg-primary">Save</button></footer><div role="dialog"><button class="bg-primary">Confirm</button></div><div data-slot="notice-card"><button class="bg-primary">Review</button></div><div data-slot="suggestion"><button class="bg-primary">Apply</button></div><button class="bg-primary" hidden>Hidden</button></main>';

    assert.deepEqual(placeFindings(summarizeWords(readWords(), "app")), []);
  });
});
