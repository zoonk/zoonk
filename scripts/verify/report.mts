import { relative } from "node:path";
import { CLS_DIGITS, type Finding, cumulativeLayoutShift } from "./checks.mts";
import { type LoadReport, type NavigationReport } from "./measure.mts";
import { classifyRequest } from "./requests.mts";

export type Place = { page: string; screen: string };
type Group = Finding & { values: number[]; where: Place[] };

const KILOBYTE = 1024;

function format(value: number | null, unit = " ms"): string {
  return value === null ? "–" : `${Math.round(value)}${unit}`;
}

function formatValue(value: number, unit: string | undefined): string {
  return unit === "CLS" ? value.toFixed(CLS_DIGITS) : `${Math.round(value)} ${unit ?? ""}`.trim();
}

/** Findings that repeat across screens are listed once, with every screen they showed on. */
function groupFindings(entries: { findings: Finding[]; place: Place }[]): Group[] {
  const groups = new Map<string, Group>();

  for (const { findings, place } of entries) {
    for (const finding of findings) {
      const key = `${finding.level} ${finding.check} ${finding.message}`;
      const group = groups.get(key) ?? { ...finding, values: [], where: [] };

      // A message logged twice in one load is still one place.
      if (!group.where.some((seen) => seen.page === place.page && seen.screen === place.screen)) {
        group.where.push(place);
      }

      if (finding.value !== undefined) {
        group.values.push(finding.value);
      }

      groups.set(key, group);
    }
  }

  return [...groups.values()];
}

/** "/plan (every screen)" or "/plan (phone light, laptop dark)", page by page. */
function describePlaces(places: Place[], screensPerPage: Map<string, number>): string {
  const pages = Map.groupBy(places, (place) => place.page);

  return [...pages]
    .map(([page, here]) =>
      here.length === screensPerPage.get(page)
        ? `${page} (every screen)`
        : `${page} (${here.map((place) => place.screen).join(", ")})`,
    )
    .join("; ");
}

function list(title: string, groups: Group[], screensPerPage: Map<string, number>): string[] {
  if (groups.length === 0) {
    return [];
  }

  return [
    `### ${title}`,
    "",
    ...groups.map((group) => {
      const low = Math.min(...group.values);
      const high = Math.max(...group.values);

      const range =
        low === high
          ? formatValue(low, group.unit)
          : `${formatValue(low, group.unit)}–${formatValue(high, group.unit)}`;

      const measured = group.values.length > 0 ? ` [${range}]` : "";
      return `- **${group.check}**${measured}: ${group.message} — ${describePlaces(group.where, screensPerPage)}`;
    }),
    "",
  ];
}

function loadRows(loads: LoadReport[], out: string): string[] {
  return [
    "| Page | Screen | TTFB | FCP | LCP | TBT | CLS | Server CPU | KB (HTML/JS/all) | Skeleton shown | Paints (last) | Screenshots |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...loads.map((load) => {
      const kilobytes = [load.bytes.html, load.bytes.scripts, load.bytes.total].map((bytes) =>
        Math.round(bytes / KILOBYTE),
      );

      return `| ${[
        load.path,
        load.viewport,
        format(load.ttfbMs),
        format(load.fcpMs),
        format(load.lcpMs),
        format(load.blockingMs),
        cumulativeLayoutShift(load.shifts).toFixed(CLS_DIGITS),
        format(load.serverCpuMs),
        kilobytes.join("/"),
        load.skeletonSeenMs === null
          ? "–"
          : `${Math.round(load.skeletonSeenMs)}–${format(load.skeletonLastMs)}`,
        `${load.frames.length} (${format(load.frames.at(-1) ?? null)})`,
        load.screenshots.map((screenshot) => relative(out, screenshot)).join(", "),
      ].join(" | ")} |`;
    }),
  ];
}

/** "prefetch ×9, asset ×13": what a navigation fetched after the tap. */
function countKinds(navigation: NavigationReport): string {
  const kinds = Map.groupBy(navigation.requests, (request) => classifyRequest(request));
  return [...kinds].map(([kind, requests]) => `${kind} ×${requests.length}`).join(", ") || "none";
}

function navigationRows(navigations: NavigationReport[]): string[] {
  if (navigations.length === 0) {
    return [];
  }

  return [
    "## Navigations",
    "",
    "| From → to | Screen | URL changed | Settled | Skeleton at | Requests after the tap |",
    "| --- | --- | --- | --- | --- | --- |",
    ...navigations.map(
      (navigation) =>
        `| ${navigation.from} → ${navigation.to} | ${navigation.viewport} | ${format(navigation.commitMs)} | ${format(navigation.settleMs)} | ${format(navigation.skeletonSeenMs)} | ${countKinds(navigation)} |`,
    ),
    "",
  ];
}

/** The run's report in Markdown, its failures first, and how many failures it has. */
export function renderReport({
  extra,
  header,
  loads,
  navigations,
  out,
  sections,
  sheets,
}: {
  /** Findings from the run's other checks (exposure, memory, the baseline), with where they apply. */
  extra: { findings: Finding[]; place: Place }[];
  header: string[];
  loads: LoadReport[];
  navigations: NavigationReport[];
  out: string;
  /** Those checks' own tables, after the loads and navigations. */
  sections: string[];
  sheets: string[];
}) {
  const groups = groupFindings([
    ...extra,
    ...loads.map((load) => ({
      findings: load.findings,
      place: { page: load.path, screen: load.viewport },
    })),
    ...navigations.map((navigation) => ({
      findings: navigation.findings,
      place: { page: `${navigation.from} → ${navigation.to}`, screen: navigation.viewport },
    })),
  ]);

  const screensPerPage = new Map([
    ...[...Map.groupBy(loads, (load) => load.path)].map(
      ([page, here]) => [page, here.length] as const,
    ),
    ...[...Map.groupBy(navigations, (navigation) => `${navigation.from} → ${navigation.to}`)].map(
      ([page, here]) => [page, here.length] as const,
    ),
  ]);

  const failures = groups.filter((group) => group.level === "fail");
  const warnings = groups.filter((group) => group.level === "warn");

  const markdown = [
    "# Page verification",
    "",
    ...header.map((line) => `- ${line}`),
    "",
    `## ${failures.length} failing and ${warnings.length} to look at`,
    "",
    `Each is listed once with every screen it showed on, across ${loads.length} loads${navigations.length > 0 ? ` and ${navigations.length} navigations` : ""}.`,
    "",
    "Contact sheets, to look at first: every screen in each scheme, and every paint of each load.",
    "",
    ...sheets.map((sheet) => `- ${relative(out, sheet)}`),
    "",
    ...list("Failing", failures, screensPerPage),
    ...list("Look at", warnings, screensPerPage),
    "## Loads",
    "",
    ...loadRows(loads, out),
    "",
    ...navigationRows(navigations),
    ...sections,
    "Paints are the screencast's frames after the navigation started, in the first color scheme, saved beside the screenshots in each screen's `-frames` folder and named by their time. More than a couple after the first paint, or a late last one, means the page changed after it appeared: a flash, a swap, a late image or an animation. Open them to see which.",
  ].join("\n");

  return { failures: failures.length, markdown };
}
