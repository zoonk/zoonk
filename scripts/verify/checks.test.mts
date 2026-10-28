import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  type LoadMeasurement,
  cumulativeLayoutShift,
  judgeLoad,
  markBusy,
  totalBlockingTime,
} from "./checks.mts";
import { type NavigationMeasurement, judgeNavigation } from "./navigation-checks.mts";
import { type RequestRecord, classifyRequest, pathOf, redactQuery } from "./requests.mts";
import { parseCpuTime } from "./server-process.mts";

const PAGE = "http://localhost:3000";
const STEADY_GAP_MS = 800;
const FIRST_PAINT_MS = 800;
const BLOCKED_MS = 70;
const STRADDLE_BLOCKED_MS = 150;

function requestTo(path: string, overrides: Partial<RequestRecord> = {}): RequestRecord {
  return { headers: {}, method: "GET", resourceType: "fetch", url: `${PAGE}${path}`, ...overrides };
}

function load(overrides: Partial<LoadMeasurement> = {}): LoadMeasurement {
  return {
    accessibility: [],
    blankSeenMs: null,
    blockingMs: 120,
    console: [],
    contentMs: null,
    fcpMs: 300,
    lastPaintMs: 400,
    lcpMs: 400,
    overflow: { offenders: [], scrollWidth: 390, viewportWidth: 390 },
    pageErrors: [],
    production: true,
    regularContrast: [],
    requests: [requestTo("/today", { resourceType: "document", status: 200 })],
    serverCpuMs: 40,
    settled: true,
    shifts: [],
    skeletonLastMs: null,
    skeletonSeenMs: null,
    truncated: [],
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
    [{ ...requestTo("/"), url: "https://va.vercel-scripts.com/v1/script.debug.js" }, "analytics"],
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

  it("allows hard-load skeletons and judges speed and prefetching only in production", () => {
    const slow = {
      lcpMs: 4000,
      serverCpuMs: 1500,
      skeletonSeenMs: 120,
      unprefetchedLinks: ["/plan"],
    };

    assert.deepEqual(checks(load({ ...slow, production: false })), []);

    assert.deepEqual(checks(load(slow)), ["fail LCP", "fail server CPU", "warn not prefetched"]);
  });

  it("says when it can't vouch for a load: still changing, or no largest paint", () => {
    assert.deepEqual(checks(load({ lcpMs: null, settled: false })), [
      "warn never settled",
      "warn LCP",
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

describe("judging on a busy machine", () => {
  it("keeps timing to look at, marked inconclusive, and everything else as it was", () => {
    const findings = markBusy([
      {
        check: "complete content",
        level: "fail",
        message: "over 2500 ms",
        unit: "ms",
        value: 3000,
      },
      { check: "navigation", level: "fail", message: "the tap didn't reach the page" },
      {
        check: "blank frame",
        level: "fail",
        message: "the viewport was blank",
        unit: "ms",
        value: 40,
      },
    ]);

    assert.deepEqual(
      findings.map((finding) => `${finding.level} ${finding.check}`),
      ["warn complete content", "fail navigation", "fail blank frame"],
    );

    assert.match(findings[0]?.message ?? "", /inconclusive: the machine was busy/u);
  });
});

describe("main-thread blocking and cut-off text", () => {
  it("counts each long task's time past 50 ms, from the first paint", () => {
    const tasks = [
      { at: 100, duration: 400 },
      { at: 900, duration: 120 },
      { at: 1200, duration: 40 },
    ];

    // The first task ran before the first paint; the third blocked nothing.
    assert.equal(totalBlockingTime(tasks, FIRST_PAINT_MS), BLOCKED_MS);

    // A task that straddles the first paint counts for its part after it.
    assert.equal(
      totalBlockingTime([{ at: 700, duration: 300 }], FIRST_PAINT_MS),
      STRADDLE_BLOCKED_MS,
    );

    assert.deepEqual(checks(load({ blockingMs: 700 })), ["fail blocking time"]);
  });

  it("asks about text that doesn't fit, once per text", () => {
    assert.deepEqual(checks(load({ truncated: ["Por que os preços se mexem"] })), ["warn cut off"]);
  });
});

describe("judging a navigation", () => {
  const navigation: NavigationMeasurement = {
    arrived: true,
    blankSeenMs: null,
    commitMs: 40,
    console: [],
    contentMs: null,
    fullLoad: false,
    linkFound: true,
    pageErrors: [],
    production: true,
    requests: [],
    settled: true,
    shifts: [],
    skeletonSeenMs: null,
  };

  it("passes a prefetched page that appears at once", () => {
    assert.deepEqual(judgeNavigation(navigation), []);
  });

  it("allows skeletons, fails a slow switch, and asks about a missing link", () => {
    const slow = judgeNavigation({ ...navigation, commitMs: 1500, skeletonSeenMs: 30 });

    assert.deepEqual(
      slow.map((finding) => `${finding.level} ${finding.check}`),
      ["fail navigation"],
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

  it("fails missing first paints and destination frames", () => {
    assert.ok(checks(load({ fcpMs: null })).includes("fail blank frame"));
    assert.equal(judgeNavigation({ ...navigation, commitMs: null })[0]?.check, "navigation");
  });

  it("fails blank painted frames on loads and taps", () => {
    assert.deepEqual(checks(load({ blankSeenMs: 40 })), ["fail blank frame"]);
    assert.equal(judgeNavigation({ ...navigation, blankSeenMs: 40 })[0]?.check, "blank frame");
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

describe("paths in reports", () => {
  it("keeps a query's names and drops its values, which can carry a credential", () => {
    assert.equal(
      redactQuery("/auth/callback?token=secret&next=%2Ftoday"),
      "/auth/callback?token=…&next=…",
    );

    assert.equal(redactQuery("/plan"), "/plan");
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
