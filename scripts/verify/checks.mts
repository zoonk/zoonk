import { errorFindings, requestFindings } from "./request-checks.mts";
import { type RequestRecord } from "./requests.mts";

/**
 * Speed is judged only on a production build (`pnpm start`): a dev server compiles on demand,
 * streams without prefetching and shows loading states a learner never sees.
 */
export const BUDGETS = {
  /** Lighthouse's Total Blocking Time lines: past them, taps wait on the main thread (INP). */
  blockingMs: { fail: 600, warn: 200 },
  /** Core Web Vitals' "good" line fails; any shift at all is listed, since a page shouldn't jump. */
  cls: { fail: 0.1, warn: 0 },
  fcpMs: { fail: 1800, warn: 1000 },
  lateChangeMs: { warn: 1000 },
  lcpMs: { fail: 2500, warn: 1200 },
  navigationCommitMs: { fail: 1000, warn: 200 },
  /** A page's RSC data in its HTML: client components' props, which every prefetch carries too. */
  rscKb: { warn: 300 },
  serverCpuMs: { fail: 1000, warn: 250 },
  /** From the tap to its page's content on screen: skeletons on the way are fine. */
  tapContentMs: { fail: 2500, warn: 1000 },
  /** From the tap to anything it changed on screen: the new page, or the link showing it's waiting. */
  tapResponseMs: { fail: 500, warn: 100 },
};

export const CLS_DIGITS = 4;

const KILOBYTE = 1024;

/**
 * `message` stays the same wherever it happens, so the report lists it once with every screen it
 * showed on; what was measured goes in `value`.
 */
export type Finding = {
  check: string;
  level: "fail" | "warn";
  message: string;
  unit?: string;
  value?: number;
};

export type LayoutShift = { at: number; sources: string[]; value: number };

export type LoadMeasurement = {
  accessibility: string[];
  blankSeenMs: number | null;
  /** No skeleton in its main region and nearly all the words it settled on (`content-frames.mts`). */
  contentMs: number | null;
  /** Times it showed its content, then a skeleton or most of it gone, then its content again. */
  flashes: number;
  /** When its links came alive (its first prefetch), in ms since the navigation started. */
  linksLiveMs: number | null;
  prefetches: number;
  rscBytes: number;
  shellWords: number | null;
  blockingMs: number | null;
  console: { text: string; type: "error" | "warning" }[];
  fcpMs: number | null;
  lastPaintMs: number | null;
  lcpMs: number | null;
  overflow: { offenders: string[]; scrollWidth: number; viewportWidth: number };
  pageErrors: string[];
  production: boolean;
  /** Contrast failures in the regular look (the checks above run with more contrast). */
  regularContrast: string[];
  requests: RequestRecord[];
  serverCpuMs: number | null;
  settled: boolean;
  shifts: LayoutShift[];
  skeletonLastMs: number | null;
  skeletonSeenMs: number | null;
  truncated: string[];
  ttfbMs: number | null;
  unprefetchedLinks: string[];
};

const LISTED_SOURCES = 5;
/** Core Web Vitals' session window: shifts under 1 s apart, within 5 s of the first. */
const SESSION_GAP_MS = 1000;
const SESSION_LIMIT_MS = 5000;

/** A long task's share that blocks input: everything past 50 ms. */
const BLOCKING_AFTER_MS = 50;

/**
 * As Lighthouse scores it: each long task clipped to start no earlier than the first contentful
 * paint, so a task that straddles the paint counts for its part after it.
 */
export function totalBlockingTime(
  longTasks: { at: number; duration: number }[],
  fcpMs: number | null,
): number {
  return longTasks.reduce((total, task) => {
    const start = Math.max(task.at, fcpMs ?? task.at);
    const duration = task.at + task.duration - start;
    return total + Math.max(0, duration - BLOCKING_AFTER_MS);
  }, 0);
}

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

export function budgetFinding({
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

export function shiftFindings(cls: number, shifts: LayoutShift[]): Finding[] {
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

export function blankFindings(seenMs: number | null): Finding[] {
  return seenMs === null
    ? []
    : [
        {
          check: "blank frame",
          level: "fail",
          message: "the viewport was blank",
          unit: "ms",
          value: seenMs,
        },
      ];
}

function speedFindings(load: LoadMeasurement): Finding[] {
  if (!load.production) {
    return [];
  }

  const lateChangeMs =
    load.lastPaintMs === null || load.lcpMs === null ? null : load.lastPaintMs - load.lcpMs;

  return [
    ...(load.fcpMs === null
      ? [
          {
            check: "blank frame",
            level: "fail" as const,
            message: "no first contentful paint recorded",
          },
        ]
      : blankFindings(load.blankSeenMs)),
    ...(load.contentMs === null
      ? [
          {
            check: "content",
            level: "warn" as const,
            message: "not measured: no complete content frame was recorded",
          },
        ]
      : budgetFinding({ budget: BUDGETS.lcpMs, check: "content", value: load.contentMs })),
    ...budgetFinding({ budget: BUDGETS.lcpMs, check: "LCP", value: load.lcpMs }),
    ...budgetFinding({ budget: BUDGETS.fcpMs, check: "FCP", value: load.fcpMs }),
    ...budgetFinding({
      budget: BUDGETS.blockingMs,
      check: "blocking time",
      value: load.blockingMs,
    }),
    ...budgetFinding({ budget: BUDGETS.serverCpuMs, check: "server CPU", value: load.serverCpuMs }),
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

export const UNSETTLED: Finding = {
  check: "never settled",
  level: "warn",
  message:
    "still changing or loading 10 s later: a poll, a loop or an endless animation? Its numbers are partial",
};

function trustFindings(load: LoadMeasurement): Finding[] {
  return [
    ...(load.settled ? [] : [UNSETTLED]),
    ...(load.production && load.lcpMs === null
      ? [
          {
            check: "LCP",
            level: "warn" as const,
            message: "not measured: no largest paint was reported",
          },
        ]
      : []),
  ];
}

export function flashFindings(flashes: number): Finding[] {
  return flashes > 0
    ? [
        {
          check: "flash",
          level: "fail",
          message: "showed its content, then a skeleton or most of it gone, then its content again",
          value: flashes,
        },
      ]
    : [];
}

function shellFindings(load: LoadMeasurement): Finding[] {
  return [
    ...(load.production && load.shellWords === 0
      ? [
          {
            check: "shell words",
            level: "warn" as const,
            message:
              "the first paint had no words in the page: draw its static words (title, labels) in the shell",
          },
        ]
      : []),
    ...(load.rscBytes / KILOBYTE > BUDGETS.rscKb.warn
      ? [
          {
            check: "payload",
            level: "warn" as const,
            message: `over ${BUDGETS.rscKb.warn} KB of RSC data in the page: pass client components only what they draw`,
            unit: "KB",
            value: Math.round(load.rscBytes / KILOBYTE),
          },
        ]
      : []),
  ];
}

export function judgeLoad(load: LoadMeasurement): Finding[] {
  const findings: Finding[] = [
    ...errorFindings(load),
    ...requestFindings(load.requests),
    ...shiftFindings(cumulativeLayoutShift(load.shifts), load.shifts),
    ...speedFindings(load),
    ...(load.production ? flashFindings(load.flashes) : []),
    ...shellFindings(load),
    ...overflowFindings(load.overflow),
    ...load.accessibility.map((message): Finding => ({
      check: "accessibility",
      level: "fail",
      message,
    })),
    ...trustFindings(load),
    ...load.regularContrast.map((message): Finding => ({
      check: "neutral text contrast",
      level: "warn",
      message: `${message} (gray text below WCAG AA in the regular look; leave colored marks soft)`,
    })),
    ...load.truncated.map((text): Finding => ({
      check: "cut off",
      level: "warn",
      message: `"${text}" doesn't fit its box`,
    })),
  ];

  return findings.toSorted((a, b) => Number(a.level === "warn") - Number(b.level === "warn"));
}

const TIMING_CHECKS = new Set([
  "FCP",
  "LCP",
  "blocking time",
  "content",
  "late change",
  "memory",
  "navigation",
  "regression",
  "server CPU",
  "tap content",
  "tap response",
]);

/**
 * On a busy machine, timing findings can't tell the change from the load, so they're inconclusive
 * instead of failing.
 */
export function markBusy(findings: Finding[]): Finding[] {
  return findings.map((finding) =>
    // A navigation's timing has a unit; one that never arrived or had no link doesn't.
    TIMING_CHECKS.has(finding.check) &&
    (finding.check !== "navigation" || finding.unit !== undefined)
      ? {
          ...finding,
          level: "warn",
          message: `${finding.message} (inconclusive: the machine was busy)`,
        }
      : finding,
  );
}
