import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cumulativeLayoutShift } from "./checks.mts";
import { type LoadReport } from "./measure.mts";

const KILOBYTE = 1024;

/** The numbers compared between runs, from a load. */
type Loaded = Pick<
  LoadReport,
  | "blockingMs"
  | "bytes"
  | "fcpMs"
  | "lcpMs"
  | "mainThreadMs"
  | "path"
  | "production"
  | "screenshots"
  | "serverCpuMs"
  | "shifts"
  | "viewport"
>;

const METRICS = [
  "lcpMs",
  "fcpMs",
  "blockingMs",
  "mainThreadMs",
  "cls",
  "serverCpuMs",
  "scriptsKb",
] as const;

type Metric = (typeof METRICS)[number];

/**
 * How much worse a load may get before it's called a regression: past both a share and an
 * amount, so noise on small numbers and small moves on big ones don't count.
 */
const REGRESSION: Record<Metric, { label: string; minimum: number; share: number; unit: string }> =
  {
    blockingMs: { label: "blocking time", minimum: 50, share: 0.2, unit: "ms" },
    cls: { label: "CLS", minimum: 0.01, share: 0, unit: "" },
    fcpMs: { label: "FCP", minimum: 100, share: 0.2, unit: "ms" },
    lcpMs: { label: "LCP", minimum: 100, share: 0.2, unit: "ms" },
    mainThreadMs: { label: "main-thread work", minimum: 50, share: 0.2, unit: "ms" },
    scriptsKb: { label: "JS", minimum: 10, share: 0.05, unit: "KB" },
    serverCpuMs: { label: "server CPU", minimum: 50, share: 0.25, unit: "ms" },
  };

/** A load's value for `metric`, or null when it (or an older report) didn't measure it. */
function measure(load: Loaded, metric: Metric): number | null {
  if (metric === "cls") {
    return cumulativeLayoutShift(load.shifts);
  }

  const value = metric === "scriptsKb" ? load.bytes.scripts / KILOBYTE : load[metric];
  return typeof value === "number" ? value : null;
}

/** The loads a previous run saved (`--baseline <its folder>`), and whether it throttled them. */
export async function readBaseline(
  directory: string,
): Promise<{ loads: Loaded[]; throttle: boolean | null }> {
  const report: unknown = JSON.parse(await readFile(join(directory, "report.json"), "utf8"));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This script's own report shape.
  const { loads, throttle } = report as { loads: Loaded[]; throttle?: boolean };
  return { loads, throttle: throttle ?? null };
}

function format(value: number | null, metric: Metric): string {
  if (value === null) {
    return "–";
  }

  return metric === "cls" ? value.toFixed(3) : `${Math.round(value)} ${REGRESSION[metric].unit}`;
}

function regressed(metric: Metric, was: number | null, is: number | null): boolean {
  const rule = REGRESSION[metric];
  return was !== null && is !== null && is - was > rule.minimum && is > was * (1 + rule.share);
}

/**
 * Each page's numbers on each screen before and after, and, when both runs measured production
 * builds with the same throttling, a finding for every one that got clearly worse. Screens are
 * compared one by one, so a regression on the phone alone isn't averaged away by the others.
 */
export function compareWithBaseline(
  baseline: Loaded[],
  current: Loaded[],
  { sameSettings }: { sameSettings: boolean },
) {
  const key = (load: Loaded) => `${load.path} ${load.viewport}`;
  const before = new Map(baseline.map((load) => [key(load), load]));
  const judged = sameSettings && [...baseline, ...current].every((load) => load.production);

  const rows = current.map((now) => {
    const then = before.get(key(now));

    const cells = METRICS.map((metric) => {
      const was = then ? measure(then, metric) : null;
      return `${format(was, metric)} → ${format(measure(now, metric), metric)}`;
    });

    return [now.path, now.viewport, ...cells];
  });

  const findings = current.flatMap((now) => {
    const then = before.get(key(now));

    if (!judged || !then) {
      return [];
    }

    return METRICS.filter((metric) =>
      regressed(metric, measure(then, metric), measure(now, metric)),
    ).map((metric) => ({
      finding: {
        check: "regression",
        level: "warn" as const,
        message: `${REGRESSION[metric].label} got worse: ${format(measure(then, metric), metric)} → ${format(measure(now, metric), metric)}`,
      },
      path: now.path,
      viewport: now.viewport,
    }));
  });

  return {
    findings,
    header: ["Page", "Screen", ...METRICS.map((metric) => REGRESSION[metric].label)],
    rows,
    sameSettings,
  };
}

/** The comparison as a report table: each load's numbers, before → after. */
export function comparisonRows({
  header,
  rows,
  sameSettings,
}: ReturnType<typeof compareWithBaseline>): string[] {
  return [
    "## Compared with the baseline",
    "",
    sameSettings
      ? "Each page on each screen, before → after. One run on each side is a lab sample, not a verdict: compare runs taken back to back on a quiet machine."
      : "The baseline was measured with different throttling, so its timings aren't comparable and nothing is judged; counts and bytes still are.",
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
  ];
}
