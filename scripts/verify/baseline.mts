import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Finding, cumulativeLayoutShift } from "./checks.mts";
import { type LoadReport } from "./measure.mts";

const KILOBYTE = 1024;

/** The numbers compared between runs, from a load. */
type Loaded = Pick<
  LoadReport,
  | "blockingMs"
  | "bytes"
  | "fcpMs"
  | "lcpMs"
  | "path"
  | "production"
  | "screenshots"
  | "serverCpuMs"
  | "shifts"
  | "viewport"
>;

const METRICS = ["lcpMs", "fcpMs", "blockingMs", "cls", "serverCpuMs", "scriptsKb"] as const;
type Metric = (typeof METRICS)[number];

/**
 * How much worse a page's median may get before it's called a regression: past both a share and
 * an amount, so noise on small numbers and small moves on big ones don't count.
 */
const REGRESSION: Record<Metric, { label: string; minimum: number; share: number; unit: string }> =
  {
    blockingMs: { label: "blocking time", minimum: 50, share: 0.2, unit: "ms" },
    cls: { label: "CLS", minimum: 0.01, share: 0, unit: "" },
    fcpMs: { label: "FCP", minimum: 100, share: 0.2, unit: "ms" },
    lcpMs: { label: "LCP", minimum: 100, share: 0.2, unit: "ms" },
    scriptsKb: { label: "JS", minimum: 10, share: 0.05, unit: "KB" },
    serverCpuMs: { label: "server CPU", minimum: 50, share: 0.25, unit: "ms" },
  };

/** The middle value, skipping ones a load didn't measure (or an older report didn't record). */
function median(values: (number | null | undefined)[]): number | null {
  const known = values.filter((value) => typeof value === "number").toSorted((a, b) => a - b);
  return known.length === 0 ? null : (known[Math.floor((known.length - 1) / 2)] ?? null);
}

function measure(load: Loaded, metric: Metric): number | null {
  if (metric === "cls") {
    return cumulativeLayoutShift(load.shifts);
  }

  return metric === "scriptsKb" ? load.bytes.scripts / KILOBYTE : load[metric];
}

function summary(here: Loaded[]): Record<Metric, number | null> {
  const of = (metric: Metric) => median(here.map((load) => measure(load, metric)));

  return {
    blockingMs: of("blockingMs"),
    cls: of("cls"),
    fcpMs: of("fcpMs"),
    lcpMs: of("lcpMs"),
    scriptsKb: of("scriptsKb"),
    serverCpuMs: of("serverCpuMs"),
  };
}

/** Each page's median of every compared number across the screens it loaded on. */
function summarize(loads: Loaded[]): Map<string, Record<Metric, number | null>> {
  return new Map(
    [...Map.groupBy(loads, (load) => load.path)].map(([path, here]) => [path, summary(here)]),
  );
}

/** The loads a previous run saved (`--baseline <its folder>`). */
export async function readBaseline(directory: string): Promise<Loaded[]> {
  const report: unknown = JSON.parse(await readFile(join(directory, "report.json"), "utf8"));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This script's own report shape.
  return (report as { loads: Loaded[] }).loads;
}

function format(value: number | null, metric: Metric): string {
  if (value === null) {
    return "–";
  }

  return metric === "cls" ? value.toFixed(3) : `${Math.round(value)} ${REGRESSION[metric].unit}`;
}

/**
 * Each page's numbers before and after, and, when both runs measured production builds, a finding
 * for every one that got clearly worse (a dev server's numbers swing with compiling).
 */
export function compareWithBaseline(baseline: Loaded[], current: Loaded[]) {
  const before = summarize(baseline);
  const after = summarize(current);

  const rows = [...after].map(([path, now]) => {
    const then = before.get(path);

    return [
      path,
      ...METRICS.map(
        (metric) => `${format(then?.[metric] ?? null, metric)} → ${format(now[metric], metric)}`,
      ),
    ];
  });

  const judged = [...baseline, ...current].every((load) => load.production);

  const findings = [...after].flatMap(([path, now]) =>
    METRICS.flatMap((metric): { finding: Finding; path: string }[] => {
      const was = before.get(path)?.[metric] ?? null;
      const is = now[metric];
      const rule = REGRESSION[metric];

      if (
        !judged ||
        was === null ||
        is === null ||
        is - was <= rule.minimum ||
        is <= was * (1 + rule.share)
      ) {
        return [];
      }

      return [
        {
          finding: {
            check: "regression",
            level: "warn",
            message: `${rule.label} got worse: ${format(was, metric)} → ${format(is, metric)}`,
          },
          path,
        },
      ];
    }),
  );

  return { findings, header: ["Page", ...METRICS.map((metric) => REGRESSION[metric].label)], rows };
}

/** The comparison as a report table: each page's medians, before → after. */
export function comparisonRows({ header, rows }: ReturnType<typeof compareWithBaseline>): string[] {
  return [
    "## Compared with the baseline",
    "",
    "Each page's median across its screens, before → after.",
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
  ];
}
