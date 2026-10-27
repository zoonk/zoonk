import { type RequestRecord, classifyRequest, describeRequest } from "./requests.mts";

/**
 * The bar `pnpm verify:pages` holds a page to. A `fail` must be fixed (or the change explained);
 * a `warn` is looked at and either fixed or named in the report. Speed is judged only on a
 * production build (`pnpm start`): a dev server compiles on demand, streams without
 * prefetching and shows loading states a learner never sees.
 */
const BUDGETS = {
  /** Core Web Vitals' "good" line fails; any shift at all is listed, since a page shouldn't jump. */
  cls: { fail: 0.1, warn: 0 },
  fcpMs: { fail: 1800, warn: 1000 },
  /** A paint this long after the largest one: the page went on changing after it appeared. */
  lateChangeMs: { warn: 1000 },
  lcpMs: { fail: 2500, warn: 1200 },
  /** From the click to the new page's URL: a prefetched page is there at once. */
  navigationCommitMs: { fail: 1000, warn: 200 },
  /** The server's CPU time during one page load, its prefetches included. */
  serverCpuMs: { fail: 1000, warn: 250 },
};

/** CLS in four decimals, since a small element's visible jump scores under 0.001. */
export const CLS_DIGITS = 4;

type Level = "fail" | "warn";

/**
 * One problem. `message` stays the same wherever it happens, so the report lists it once with
 * every screen it showed on; what was measured goes in `value`.
 */
export type Finding = {
  check: string;
  level: Level;
  message: string;
  unit?: string;
  value?: number;
};

type LayoutShift = { at: number; sources: string[]; value: number };

/** What one page load measured, at one screen size and color scheme. */
export type LoadMeasurement = {
  accessibility: string[];
  console: { text: string; type: "error" | "warning" }[];
  fcpMs: number | null;
  /** The last paint the screencast saw, in ms since the navigation started. */
  lastPaintMs: number | null;
  lcpMs: number | null;
  overflow: { offenders: string[]; scrollWidth: number; viewportWidth: number };
  pageErrors: string[];
  production: boolean;
  requests: RequestRecord[];
  serverCpuMs: number | null;
  shifts: LayoutShift[];
  /** The last frame a loading skeleton was visible on. */
  skeletonLastMs: number | null;
  skeletonSeenMs: number | null;
  ttfbMs: number | null;
  unprefetchedLinks: string[];
};

/** A navigation from one page to the next, by tapping or clicking its link. */
export type NavigationMeasurement = Pick<LoadMeasurement, "console" | "pageErrors" | "requests"> & {
  /** Whether the tap ended on the page it was meant to reach. */
  arrived: boolean;
  /** From the tap to the new URL (a client navigation) or the new document's first paint. */
  commitMs: number | null;
  /** The tap loaded a whole new document instead of navigating on the client. */
  fullLoad: boolean;
  linkFound: boolean;
  production: boolean;
  shifts: LayoutShift[];
  skeletonSeenMs: number | null;
};

const HTTP_CLIENT_ERROR = 400;
const HTTP_SERVER_ERROR = 500;
const LISTED_SOURCES = 5;
/** Core Web Vitals' session window: shifts under 1 s apart, within 5 s of the first. */
const SESSION_GAP_MS = 1000;
const SESSION_LIMIT_MS = 5000;

/** CLS as Core Web Vitals scores it: the largest session window's total, not every shift's. */
export function cumulativeLayoutShift(shifts: LayoutShift[]): number {
  const start = { first: -Infinity, largest: 0, last: -Infinity, total: 0 };

  return shifts
    .toSorted((a, b) => a.at - b.at)
    .reduce((session, shift) => {
      const continues =
        shift.at - session.last < SESSION_GAP_MS && shift.at - session.first < SESSION_LIMIT_MS;

      const total = continues ? session.total + shift.value : shift.value;

      return {
        first: continues ? session.first : shift.at,
        largest: Math.max(session.largest, total),
        last: shift.at,
        total,
      };
    }, start).largest;
}

function budgetFinding({
  budget,
  check,
  value,
}: {
  budget: { fail: number; warn: number };
  check: string;
  value: number | null;
}): Finding[] {
  if (value === null || value <= budget.warn) {
    return [];
  }

  const level = value > budget.fail ? "fail" : "warn";
  const limit = level === "fail" ? budget.fail : budget.warn;
  return [{ check, level, message: `over ${limit} ms`, unit: "ms", value }];
}

function shiftFindings(cls: number, shifts: LayoutShift[]): Finding[] {
  if (cls <= BUDGETS.cls.warn) {
    return [];
  }

  const moved = [...new Set(shifts.flatMap((shift) => shift.sources))].slice(0, LISTED_SOURCES);

  return [
    {
      check: "layout shift",
      level: cls > BUDGETS.cls.fail ? "fail" : "warn",
      message: `moved: ${moved.join(", ") || "unknown"}`,
      unit: "CLS",
      value: cls,
    },
  ];
}

function skeletonFindings(seenMs: number | null, when: string): Finding[] {
  return seenMs === null
    ? []
    : [
        {
          check: "skeleton",
          level: "fail",
          message: `a loading skeleton showed ${when}`,
          unit: "ms",
          value: seenMs,
        },
      ];
}

/**
 * Chrome logs every failed response as a bare "Failed to load resource", which the failed-response
 * check names with its URL, and Vercel serves `/_vercel/` scripts only on Vercel.
 */
function isNoise(text: string): boolean {
  return text.startsWith("Failed to load resource") || text.includes("/_vercel/");
}

/** Errors and failed responses: what breaks the page whatever server it runs on. */
function errorFindings(
  load: Pick<LoadMeasurement, "console" | "pageErrors" | "requests">,
): Finding[] {
  const own = load.requests.filter((request) => classifyRequest(request) !== "analytics");

  // Next.js cancels prefetch bodies it has read enough of, and a navigation aborts the requests
  // the page it leaves still had out.
  const broken = own.filter(
    (request) => request.failure && !request.failure.includes("ERR_ABORTED"),
  );

  return [
    ...load.pageErrors.map((text): Finding => ({
      check: "uncaught error",
      level: "fail",
      message: text,
    })),
    ...load.console
      .filter((entry) => !isNoise(entry.text))
      .map((entry): Finding => ({
        check: `console ${entry.type}`,
        level: entry.type === "error" ? "fail" : "warn",
        message: entry.text,
      })),
    ...own
      .filter((request) => (request.status ?? 0) >= HTTP_CLIENT_ERROR)
      .map((request): Finding => ({
        check: "failed response",
        level: (request.status ?? 0) >= HTTP_SERVER_ERROR ? "fail" : "warn",
        message: `${request.status} ${describeRequest(request)}`,
      })),
    ...broken.map((request): Finding => ({
      check: "failed request",
      level: "warn",
      message: `${request.failure} ${describeRequest(request)}`,
    })),
  ];
}

/**
 * Work the page asked the server for on its own, before anyone touched it. A Server Action or
 * other POST might only read, but if it writes or starts AI it breaks the rule that only a
 * learner's click does; data the client fetched for itself is usually data the server should
 * have rendered with the page.
 */
function requestFindings(requests: RequestRecord[]): Finding[] {
  return requests.flatMap((request): Finding[] => {
    const kind = classifyRequest(request);

    if (kind === "analytics") {
      return [];
    }

    if (kind === "action" || (request.method !== "GET" && request.method !== "HEAD")) {
      return [
        {
          check: "POST without a click",
          level: "warn",
          message: `${describeRequest(request)}: fine if it only reads; a write or a model call before a click is a bug`,
        },
      ];
    }

    return kind === "data"
      ? [{ check: "client data fetch", level: "warn", message: describeRequest(request) }]
      : [];
  });
}

function speedFindings(load: LoadMeasurement): Finding[] {
  if (!load.production) {
    return [];
  }

  const lateChangeMs =
    load.lastPaintMs === null || load.lcpMs === null ? null : load.lastPaintMs - load.lcpMs;

  return [
    ...budgetFinding({ budget: BUDGETS.lcpMs, check: "LCP", value: load.lcpMs }),
    ...budgetFinding({ budget: BUDGETS.fcpMs, check: "FCP", value: load.fcpMs }),
    ...budgetFinding({ budget: BUDGETS.serverCpuMs, check: "server CPU", value: load.serverCpuMs }),
    ...skeletonFindings(load.skeletonSeenMs, "while the page loaded"),
    ...(lateChangeMs !== null && lateChangeMs > BUDGETS.lateChangeMs.warn
      ? [
          {
            check: "late change",
            level: "warn" as const,
            message: "the screen changed long after its largest paint: open its frames",
            unit: "ms",
            value: lateChangeMs,
          },
        ]
      : []),
    ...load.unprefetchedLinks.map((link): Finding => ({
      check: "not prefetched",
      level: "warn",
      message: `visible link ${link}`,
    })),
  ];
}

function overflowFindings({ offenders, scrollWidth, viewportWidth }: LoadMeasurement["overflow"]) {
  return scrollWidth > viewportWidth
    ? [
        {
          check: "horizontal overflow",
          level: "fail" as const,
          message: `wider than the viewport: ${offenders.join(", ") || "unknown"}`,
          unit: "px",
          value: scrollWidth - viewportWidth,
        },
      ]
    : [];
}

/** Everything one page load did wrong, failures first. */
export function judgeLoad(load: LoadMeasurement): Finding[] {
  const findings: Finding[] = [
    ...errorFindings(load),
    ...requestFindings(load.requests),
    ...shiftFindings(cumulativeLayoutShift(load.shifts), load.shifts),
    ...speedFindings(load),
    ...overflowFindings(load.overflow),
    ...load.accessibility.map((message): Finding => ({
      check: "accessibility",
      level: "fail",
      message,
    })),
  ];

  return findings.toSorted((a, b) => Number(a.level === "warn") - Number(b.level === "warn"));
}

/** What a navigation did wrong: no link, never arriving, errors, a skeleton, a jump, a slow switch. */
export function judgeNavigation(navigation: NavigationMeasurement): Finding[] {
  if (!navigation.linkFound) {
    return [{ check: "navigation", level: "warn", message: "no visible link to the next page" }];
  }

  if (!navigation.arrived) {
    return [{ check: "navigation", level: "fail", message: "the tap didn't reach the page" }];
  }

  // The page's own load lists its data fetches; a navigation adds only what nobody clicked for.
  const requests = requestFindings(navigation.requests).filter(
    (finding) => finding.check !== "client data fetch",
  );

  const always = [
    ...errorFindings(navigation),
    ...shiftFindings(cumulativeLayoutShift(navigation.shifts), navigation.shifts),
    ...requests,
  ];

  if (!navigation.production) {
    return always;
  }

  return [
    ...skeletonFindings(navigation.skeletonSeenMs, "after the tap"),
    ...budgetFinding({
      budget: BUDGETS.navigationCommitMs,
      check: "navigation",
      value: navigation.commitMs,
    }),
    ...(navigation.fullLoad
      ? [
          {
            check: "full page load",
            level: "warn" as const,
            message: "the tap loaded a whole new document instead of navigating on the client",
          },
        ]
      : []),
    ...always,
  ];
}
