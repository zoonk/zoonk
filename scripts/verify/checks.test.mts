import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  type LoadMeasurement,
  type NavigationMeasurement,
  cumulativeLayoutShift,
  judgeLoad,
  judgeNavigation,
} from "./checks.mts";
import { type RequestRecord, classifyRequest, pathOf } from "./requests.mts";
import { parseCpuTime } from "./server-cpu.mts";

const PAGE = "http://localhost:3000";
const STEADY_GAP_MS = 800;

function requestTo(path: string, overrides: Partial<RequestRecord> = {}): RequestRecord {
  return { headers: {}, method: "GET", resourceType: "fetch", url: `${PAGE}${path}`, ...overrides };
}

function load(overrides: Partial<LoadMeasurement> = {}): LoadMeasurement {
  return {
    accessibility: [],
    console: [],
    fcpMs: 300,
    lastPaintMs: 400,
    lcpMs: 400,
    overflow: { offenders: [], scrollWidth: 390, viewportWidth: 390 },
    pageErrors: [],
    production: true,
    requests: [requestTo("/today", { resourceType: "document", status: 200 })],
    serverCpuMs: 40,
    shifts: [],
    skeletonLastMs: null,
    skeletonSeenMs: null,
    ttfbMs: 100,
    unprefetchedLinks: [],
    ...overrides,
  };
}

function checks(measurement: LoadMeasurement) {
  return judgeLoad(measurement).map((finding) => `${finding.level} ${finding.check}`);
}

describe("what a page's requests were for", () => {
  it.each([
    [requestTo("/today", { resourceType: "document" }), "document"],
    [requestTo("/plan", { headers: { "next-router-prefetch": "1", rsc: "1" } }), "prefetch"],
    [requestTo("/plan", { headers: { rsc: "1" } }), "navigation"],
    [requestTo("/today", { headers: { "next-action": "abc" }, method: "POST" }), "action"],
    [requestTo("/_vercel/insights/view", { method: "POST" }), "analytics"],
    [requestTo("/api/goals"), "data"],
    [requestTo("/_next/static/chunks/app.js", { resourceType: "script" }), "asset"],
  ] as const)("%o is %s", (request, kind) => {
    assert.equal(classifyRequest(request), kind);
  });
});

describe("judging a page load", () => {
  it("passes a quiet, fast page", () => {
    assert.deepEqual(checks(load()), []);
  });

  it("asks about POSTs nobody clicked for and client data fetches, not analytics", () => {
    const requests = [
      requestTo("/today", { headers: { "next-action": "abc" }, method: "POST" }),
      requestTo("/_vercel/insights/view", { method: "POST" }),
      requestTo("/api/goals"),
    ];

    assert.deepEqual(checks(load({ requests })), [
      "warn POST without a click",
      "warn client data fetch",
    ]);
  });

  it("lists any shift, and fails past Core Web Vitals' line", () => {
    const shift = { at: 500, sources: ['div[data-slot=page-header] "Today"'], value: 0.02 };
    assert.deepEqual(checks(load({ shifts: [shift] })), ["warn layout shift"]);
    assert.deepEqual(checks(load({ shifts: [{ ...shift, value: 0.3 }] })), ["fail layout shift"]);
  });

  it.each([
    {
      cls: "0.06",
      name: "two shifts over a second apart are two windows",
      shifts: [
        { at: 100, value: 0.06 },
        { at: 1500, value: 0.06 },
      ],
    },
    {
      cls: "0.12",
      name: "shifts under a second apart add up",
      shifts: [
        { at: 100, value: 0.06 },
        { at: 900, value: 0.06 },
      ],
    },
    {
      cls: "0.07",
      name: "a window ends 5 s after its first shift",
      // A small shift every 800 ms for 5.6 s: the first seven fall inside one 5 s window.
      shifts: Array.from({ length: 8 }, (_, index) => ({ at: index * STEADY_GAP_MS, value: 0.01 })),
    },
  ])("scores CLS by its largest session window: $name", ({ cls, shifts }) => {
    const scored = cumulativeLayoutShift(shifts.map((shift) => ({ ...shift, sources: [] })));
    assert.equal(scored.toFixed(2), cls);
  });

  it("judges speed, skeletons and prefetching only on a production build", () => {
    const slow = {
      lcpMs: 4000,
      serverCpuMs: 1500,
      skeletonSeenMs: 120,
      unprefetchedLinks: ["/plan"],
    };

    assert.deepEqual(checks(load({ ...slow, production: false })), []);

    assert.deepEqual(checks(load(slow)), [
      "fail LCP",
      "fail server CPU",
      "fail skeleton",
      "warn not prefetched",
    ]);
  });

  it("asks about a screen that changed long after its largest paint", () => {
    assert.deepEqual(checks(load({ lastPaintMs: 900 })), []);
    assert.deepEqual(checks(load({ lastPaintMs: 5600 })), ["warn late change"]);
  });

  it("leaves out what only Vercel serves and Chrome's duplicate of a failed response", () => {
    const measurement = load({
      console: [
        {
          text: "Failed to load resource: the server responded with a status of 404",
          type: "error",
        },
        { text: "Refused to execute script from '/_vercel/insights/script.js'", type: "error" },
      ],
      requests: [requestTo("/_vercel/insights/script.js", { resourceType: "script", status: 404 })],
    });

    assert.deepEqual(checks(measurement), []);
  });

  it("fails errors, server errors and sideways scrolling; aborted prefetches are fine", () => {
    const measurement = load({
      console: [{ text: "Hydration failed", type: "error" }],
      overflow: { offenders: ['div "Week"'], scrollWidth: 420, viewportWidth: 390 },
      requests: [
        requestTo("/plan", { failure: "net::ERR_ABORTED", headers: { rsc: "1" } }),
        requestTo("/api/me", { status: 500 }),
      ],
    });

    assert.deepEqual(checks(measurement), [
      "fail console error",
      "fail failed response",
      "fail horizontal overflow",
      "warn client data fetch",
    ]);
  });
});

describe("judging a navigation", () => {
  const navigation: NavigationMeasurement = {
    arrived: true,
    commitMs: 40,
    console: [],
    fullLoad: false,
    linkFound: true,
    pageErrors: [],
    production: true,
    requests: [],
    shifts: [],
    skeletonSeenMs: null,
  };

  it("passes a prefetched page that appears at once", () => {
    assert.deepEqual(judgeNavigation(navigation), []);
  });

  it("fails a skeleton and a slow switch, and asks about a missing link", () => {
    const slow = judgeNavigation({ ...navigation, commitMs: 1500, skeletonSeenMs: 30 });

    assert.deepEqual(
      slow.map((finding) => `${finding.level} ${finding.check}`),
      ["fail skeleton", "fail navigation"],
    );

    assert.equal(judgeNavigation({ ...navigation, linkFound: false })[0]?.level, "warn");
  });

  it("fails a tap that never reached its page, and errors along the way", () => {
    const lost = judgeNavigation({ ...navigation, arrived: false, commitMs: null });

    assert.deepEqual(
      lost.map((finding) => `${finding.level} ${finding.check}`),
      ["fail navigation"],
    );

    const broken = judgeNavigation({
      ...navigation,
      requests: [requestTo("/plan", { headers: { rsc: "1" }, status: 500 })],
    });

    assert.deepEqual(
      broken.map((finding) => `${finding.level} ${finding.check}`),
      ["fail failed response"],
    );
  });

  it("asks about a tap that loaded a whole new document", () => {
    const full = judgeNavigation({ ...navigation, fullLoad: true });

    assert.deepEqual(
      full.map((finding) => finding.check),
      ["full page load"],
    );
  });
});

describe("where a link or request goes", () => {
  it("keeps the query, which tells pages apart, and drops Next.js's cache key", () => {
    assert.equal(pathOf(`${PAGE}/buddy/earlier?cursor=b&_rsc=x1`), "/buddy/earlier?cursor=b");
    assert.equal(pathOf(`${PAGE}/plan?_rsc=x1`), "/plan");
  });
});

describe("server CPU time", () => {
  it.each([
    { ms: 1230, text: "0:01.23" },
    { ms: 62_500, text: "1:02.50" },
    { ms: 3_723_000, text: "01:02:03" },
  ])("reads $text as $ms ms", ({ ms, text }) => {
    assert.equal(parseCpuTime(text), ms);
  });
});
