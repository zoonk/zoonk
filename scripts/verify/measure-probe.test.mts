import assert from "node:assert/strict";
import { type Browser } from "@playwright/test";
import { test, vi } from "vitest";
import { type Target, measureLoad } from "./measure.mts";
import { renderReport } from "./report.mts";

const TYPE_SIZE = 16;

const platform = vi.hoisted(() => {
  const measurements: Record<string, unknown> = {
    findOverflow: { offenders: [], scrollWidth: 1024, viewportWidth: 1024 },
    findTruncated: [],
    isNextDev: false,
    readCraft: {
      controls: [],
      gaps: [],
      icons: [],
      ink: [],
      radius: 8,
      texts: [{ block: -1, inline: false, label: "An odd size", size: 19 }],
    },
    readProbe: null,
    readRoleFacts: { backLinksWithoutText: 0, gates: 2, unmarkedEyebrows: [] },
    readWords: {
      aboveAction: 0,
      action: "Continue",
      actionPinned: false,
      buttons: ["Continue"],
      text: "Choose",
      titleTop: { actual: 101, expected: 69 },
    },
    transferredBytes: { html: 0, scripts: 0, total: 0 },
    visibleLinks: [],
  };

  return {
    close: vi.fn(),
    page: {
      evaluate: async (reader: () => unknown) =>
        reader.name in measurements ? measurements[reader.name] : 0,
      goto: async () => null,
      waitForLoadState: () => Promise.resolve(),
    },
  };
});

// The browser/CDP boundary supplies already measured facts; the load composes the real verdicts.
vi.mock("./browser.mts", () => ({
  checkSchemes: async () => ({ accessibility: [], regularContrast: [], screenshots: [] }),
  openPage: async () => ({
    cdp: {},
    context: { close: platform.close },
    page: platform.page,
    traffic: { console: [], pageErrors: [], requests: [] },
  }),
  readMainThreadMs: async () => 0,
  recordScreencast: async () => ({ frames: [], stop: () => Promise.resolve() }),
  saveFrames: async () => [],
  unthrottle: () => Promise.resolve(),
  waitForQuiet: async () => true,
}));

test("keeps craft, role, pinned-action and title findings in a measured load", async () => {
  const target: Target = {
    actions: new Map(),
    app: "main",
    baseUrl: "https://fixture.test",
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- openPage is the mocked browser boundary; it never uses this handle.
    browser: {} as Browser,
    out: "/unused",
    pageTop: null,
    serverPid: null,
    shortcuts: null,
    throttle: false,
    typeScale: [TYPE_SIZE],
  };

  const result = await measureLoad(target, {
    path: "/today",
    schemes: ["light"],
    viewport: "phone",
  });

  const checks = result.findings.map((finding) => finding.check);

  for (const prefix of ["T1 ", "R4 ", "R2 ", "E8 "]) {
    assert.equal(
      checks.some((check) => check.startsWith(prefix)),
      true,
      prefix,
    );
  }

  assert.equal(platform.close.mock.calls.length, 1);

  const { markdown } = renderReport({
    extra: [],
    header: [],
    loads: [{ ...result, walk: { actionsSkipped: 3, actionsTried: 7, panelsOpened: 2 } }],
    navigations: [],
    out: "/unused",
    sections: [],
    sheets: [],
  });

  assert.ok(markdown.includes("Walk (panels / actions tried / skipped)"));
  assert.ok(markdown.includes("2 / 7 / 3"));
});
