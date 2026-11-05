import { type Finding } from "./checks.mts";

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
  "slow query",
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
