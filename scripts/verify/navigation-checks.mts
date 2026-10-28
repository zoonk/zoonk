import {
  BUDGETS,
  type Finding,
  type LayoutShift,
  type LoadMeasurement,
  UNSETTLED,
  blankFindings,
  budgetFinding,
  cumulativeLayoutShift,
  flashFindings,
  shiftFindings,
} from "./checks.mts";
import { errorFindings, requestFindings } from "./request-checks.mts";

/**
 * How the tap was set up: after the page's prefetches landed (`prefetched`), with the next page's
 * prefetches blocked (`noPrefetch`), or as soon as a cold load showed its content, before its code
 * was ready (`early`).
 */
export type NavigationMode = "early" | "noPrefetch" | "prefetched";

/** A navigation from one page to the next, by tapping or clicking its link. */
export type NavigationMeasurement = Pick<
  LoadMeasurement,
  "console" | "flashes" | "pageErrors" | "requests"
> & {
  /** Whether the tap ended on the page it was meant to reach. */
  arrived: boolean;
  blankSeenMs: number | null;
  /** From the tap to its page's content on screen (`content-frames.mts`). */
  contentMs: number | null;
  /** From the tap to the new URL (a client navigation) or the new document's first paint. */
  commitMs: number | null;
  mode: NavigationMode;
  /** From the tap to its first change on screen: the new page, or the link showing it's waiting. */
  responseMs: number | null;
  /** Whether its page showed without a request to the server for it after the tap. */
  usedPrefetch: boolean;
  /** The tap loaded a whole new document instead of navigating on the client. */
  fullLoad: boolean;
  linkFound: boolean;
  production: boolean;
  settled: boolean;
  shifts: LayoutShift[];
  skeletonSeenMs: number | null;
};

/** What a navigation did wrong: no link, never arriving, errors, a blank frame, a jump, a slow switch. */
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
    ...(navigation.settled ? [] : [UNSETTLED]),
    ...errorFindings(navigation),
    ...shiftFindings(cumulativeLayoutShift(navigation.shifts), navigation.shifts),
    ...requests,
  ];

  if (!navigation.production) {
    return always;
  }

  return [
    ...blankFindings(navigation.blankSeenMs),
    ...(navigation.commitMs === null
      ? [{ check: "navigation", level: "fail" as const, message: "no destination frame recorded" }]
      : []),
    ...flashFindings(navigation.flashes),
    ...budgetFinding({
      budget: BUDGETS.tapResponseMs,
      check: "tap response",
      value: navigation.responseMs,
    }),
    ...(navigation.contentMs === null
      ? [
          {
            check: "tap content",
            level: "warn" as const,
            message: "not measured: no complete destination content frame was recorded",
          },
        ]
      : budgetFinding({
          budget: BUDGETS.tapContentMs,
          check: "tap content",
          value: navigation.contentMs,
        })),
    ...budgetFinding({
      budget: BUDGETS.navigationCommitMs,
      check: "navigation",
      value: navigation.commitMs,
    }),
    ...(navigation.mode === "prefetched" && !navigation.usedPrefetch
      ? [
          {
            check: "prefetch",
            level: "warn" as const,
            message:
              "the tap waited on the server for its page: its prefetch hadn't landed or doesn't carry it",
          },
        ]
      : []),
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
