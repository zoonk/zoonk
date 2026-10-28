import {
  BUDGETS,
  type Finding,
  type LayoutShift,
  type LoadMeasurement,
  UNSETTLED,
  blankFindings,
  budgetFinding,
  cumulativeLayoutShift,
  errorFindings,
  requestFindings,
  shiftFindings,
} from "./checks.mts";

/** A navigation from one page to the next, by tapping or clicking its link. */
export type NavigationMeasurement = Pick<LoadMeasurement, "console" | "pageErrors" | "requests"> & {
  /** Whether the tap ended on the page it was meant to reach. */
  arrived: boolean;
  blankSeenMs: number | null;
  contentMs: number | null;
  /** From the tap to the new URL (a client navigation) or the new document's first paint. */
  commitMs: number | null;
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
    ...budgetFinding({
      budget: BUDGETS.lcpMs,
      check: "complete content",
      value: navigation.contentMs,
    }),
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
