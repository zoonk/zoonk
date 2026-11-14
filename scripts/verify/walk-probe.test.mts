// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import { focusReturned } from "./keys-probe.mts";
import { type Target } from "./measure.mts";
import { installPageHelpers } from "./page-helpers.mts";
import { walkStates } from "./states.mts";

vi.mock("./states-wait.mts", () => ({
  holdStill: () => Promise.resolve(),
  settle: () => Promise.resolve(),
}));

const CONTROL_HEIGHT = 44;
const GROWN_WIDTH = 200;

beforeEach(() => {
  installPageHelpers();
  const box = new DOMRect(0, 0, 100, CONTROL_HEIGHT);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(box);

  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue(
    Object.assign([box], { item: () => box }),
  );

  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: () => true,
  });

  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });

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

function elements(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector.replaceAll(":visible", ""))];
}

function fixture(html: string) {
  const origin = "https://fixture.test/";
  const state = { closed: false, fills: [] as string[], url: origin };
  const requests: { method: string; aborted: boolean; continued: boolean }[] = [];

  function locator(selector: string) {
    const element = () => elements(selector)[0];

    return {
      boundingBox: async () => null,
      click: async () => element()?.click(),
      count: async () => elements(selector).length,
      evaluate: async (run: (node: HTMLElement) => unknown) => {
        const node = element();
        assert.ok(node);
        return run(node);
      },
      fill: async (value: string) => {
        const node = element();
        assert.ok(node instanceof HTMLInputElement);
        node.value = value;
        state.fills.push(`${node.id}=${value}`);
        node.dispatchEvent(new Event("input", { bubbles: true }));
      },
      first: () => locator(selector),
      focus: async () => element()?.focus(),
      hover: () => Promise.resolve(),
      inputValue: async () => {
        const node = element();
        return node instanceof HTMLInputElement ? node.value : "";
      },
      isVisible: async () => element() !== undefined,
    };
  }

  const page = {
    evaluate: async (run: (argument: unknown) => unknown, argument?: unknown) => run(argument),
    goto: async (url: string) => {
      state.url = url;
      document.body.innerHTML = html;
    },
    keyboard: { press: () => Promise.resolve() },
    locator,
    mouse: { move: () => Promise.resolve() },
    on: vi.fn(),
    route: async (_pattern: string, handle: (route: unknown) => Promise<void>) => {
      await Promise.all(
        ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE"].map(async (method) => {
          const request = { aborted: false, continued: false, method };
          requests.push(request);

          await handle({
            abort: async () => {
              request.aborted = true;
            },
            continue: async () => {
              request.continued = true;
            },
            request: () => ({ method: () => method }),
          });
        }),
      );
    },
    url: () => state.url,
    waitForLoadState: () => Promise.resolve(),
  };

  const boundary: unknown = {
    baseUrl: origin,
    browser: {
      newContext: async () => ({
        addInitScript: async (run: () => unknown) => run(),
        close: async () => {
          state.closed = true;
        },
        newPage: async () => page,
      }),
    },
    shortcuts: null,
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This adapter models only the Playwright boundary used by the write-blocked walk.
  const target = boundary as Target;

  return { page, requests, state, target };
}

test("re-marks actions after navigation and reports how much it tried and skipped", async () => {
  const { state, target } = fixture(
    '<input id="first" /><input id="second" /><button id="gone">Gone</button>',
  );

  document.addEventListener(
    "input",
    () => {
      if (state.url.endsWith("/")) {
        state.url += "changed";
      }
    },
    { once: true },
  );

  const report = await walkStates(target, { path: "/", viewport: "phone" });
  assert.ok(state.fills.includes("second=a"));
  assert.equal(report.actionsTried, 3);
  assert.equal(report.actionsSkipped, 0);
  assert.equal(report.panelsOpened, 0);
  assert.equal(state.closed, true);
});

test("aborts every write while allowing reads", async () => {
  const { requests, target } = fixture("");
  await walkStates(target, { path: "/", viewport: "phone" });

  assert.deepEqual(
    requests.filter((request) => request.continued).map((request) => request.method),
    ["GET", "HEAD", "OPTIONS"],
  );

  assert.deepEqual(
    requests.filter((request) => request.aborted).map((request) => request.method),
    ["POST", "PUT", "DELETE"],
  );
});

test("counts actions whose controls disappeared as skipped", async () => {
  const { target } = fixture('<input id="first" /><button id="gone">Gone</button>');

  document.addEventListener("input", () => document.querySelector("#gone")?.remove(), {
    once: true,
  });

  const report = await walkStates(target, { path: "/", viewport: "phone" });
  assert.equal(report.actionsTried, 1);
  assert.equal(report.actionsSkipped, 1);
});

test("counts a marked panel opener and measures its Escape close", async () => {
  const { page, target } = fixture('<button aria-haspopup="dialog" id="open">Details</button>');

  document.addEventListener(
    "click",
    () => {
      document.body.insertAdjacentHTML(
        "beforeend",
        '<div role="dialog" data-slot="dialog-content" tabindex="-1"><h2>Details</h2><button data-slot="dialog-close">Close</button></div>',
      );

      document.querySelector<HTMLElement>("[role=dialog]")?.focus();
    },
    { once: true },
  );

  page.keyboard.press = async () => {
    document.querySelector("[role=dialog]")?.remove();
    document.querySelector<HTMLElement>("#open")?.focus();
  };

  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const report = await walkStates(target, { path: "/", viewport: "phone" });
  assert.equal(report.panelsOpened, 1);
  assert.equal(report.actionsTried, 1);
  assert.ok(!report.findings.some((finding) => finding.message.includes("focus")));
  vi.unstubAllGlobals();
});

test("turns an observed field resize into a lead instead of silently returning no findings", async () => {
  const { target } = fixture('<input id="grows" />');

  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function width(
    this: HTMLInputElement,
  ) {
    return this.value ? GROWN_WIDTH : 100;
  });

  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(CONTROL_HEIGHT);
  const report = await walkStates(target, { path: "/", viewport: "phone" });

  assert.ok(
    report.findings.some(
      (finding) => finding.check.startsWith("X3") && finding.message.includes("typing"),
    ),
  );
});

function menuClick(event: Event) {
  const node = event.target;

  if (!(node instanceof Element)) {
    return;
  }

  if (node.id === "menu-trigger") {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div role="menu" id="options" tabindex="-1"><button id="edit" role="menuitem" aria-haspopup="dialog">Edit</button></div>',
    );

    document.querySelector<HTMLElement>("[role=menu]")?.focus();
  }

  if (node.id === "edit") {
    document.querySelector("[role=menu]")?.remove();

    document.body.insertAdjacentHTML(
      "beforeend",
      '<div role="dialog" data-slot="dialog-content" tabindex="-1"><h2>Edit</h2><button data-slot="dialog-close">Close</button></div>',
    );

    document.querySelector<HTMLElement>("[role=dialog]")?.focus();
  }
}

test("opens a menu item's panel and accepts focus on the surviving menu trigger", async () => {
  const { page, target } = fixture(
    '<button id="menu-trigger" aria-haspopup="menu" aria-controls="options">Options</button><button id="unrelated">Other</button>',
  );

  document.addEventListener("click", menuClick);

  page.keyboard.press = async () => {
    document.querySelector("[role=dialog]")?.remove();
    document.querySelector<HTMLElement>("#menu-trigger")?.focus();
  };

  vi.stubGlobal("matchMedia", () => ({ matches: false }));

  try {
    const report = await walkStates(target, { path: "/", viewport: "phone" });
    assert.equal(report.panelsOpened, 2);
    assert.ok(!report.findings.some(({ message }) => message.includes("focus")));
    assert.equal(document.querySelector("[role=menu]"), null);
    document.querySelector<HTMLElement>("#unrelated")?.focus();
    assert.equal(focusReturned({ opener: "2", returnTo: "0" }), false);
  } finally {
    document.removeEventListener("click", menuClick);
    vi.unstubAllGlobals();
  }
});
