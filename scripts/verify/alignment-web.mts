/* oxlint-disable max-lines-per-function, max-statements, complexity, unicorn/consistent-function-scoping -- `readDiscovery` is sent to the page as one function, so its helpers live inside it (`probe.mts`). */
import {
  type AlignmentFile,
  type AlignmentFinding,
  configurationName,
} from "./alignment-capture.mts";
import { type Summary, alignmentLines } from "./alignment-summary.mts";
import { evaluateFile } from "./alignment.mts";
import { type Finding } from "./checks.mts";
import { type LoadReport } from "./measure.mts";

/**
 * What the page suggests outside the declared pieces: an inferred group's odd one out, and room
 * held by something that draws nothing. Leads to look at, never failures: a lead confirmed as a
 * fault is fixed together with the declaration that makes it fail next time.
 */
export type DiscoveryLead = {
  rule: "empty room" | "inferred group";
  message: string;
  detail: string;
};

export function readDiscovery(declaredGroups: string): DiscoveryLead[] {
  const TENTH = 10;
  const LABEL_LENGTH = 32;
  const MIN_ROWS = 3;
  const WIDTH_SLACK = 2;
  /** Room smaller than this either way is a hairline, not a gap anyone sees. */
  const MIN_ROOM = 8;
  const { paints, shown } = globalThis.zoonkPage;

  const round = (value: number) => Math.round(value * TENTH) / TENTH;

  const name = (element: Element) => {
    const text = globalThis.zoonkPage.label(element, true).slice(0, LABEL_LENGTH);
    const slot = element instanceof HTMLElement ? element.dataset.slot : undefined;
    return text ? `"${text}"` : `<${element.tagName.toLowerCase()}${slot ? ` ${slot}` : ""}>`;
  };

  function inked(element: Element): boolean {
    return (
      shown(element) &&
      (paints(element, ["top", "right", "bottom", "left"]) ||
        element.matches("svg, img, video, canvas, input, textarea, select") ||
        [...element.childNodes].some(
          (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
        ) ||
        [...element.children].some((child) => inked(child)))
    );
  }

  function inkBox(element: Element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect();
  }

  const declared = (element: Element) =>
    declaredGroups !== "" && element.closest(declaredGroups) !== null;

  const inFlow = (element: Element) =>
    !["absolute", "fixed"].includes(getComputedStyle(element).position);

  const kind = (element: Element) =>
    `${element.tagName} ${(element instanceof HTMLElement ? element.dataset.slot : undefined) ?? element.getAttribute("class") ?? ""}`;

  /** The value most rows share, when two thirds of them agree within a pixel. */
  function common(values: number[]) {
    const counts = Map.groupBy(values, (value) => Math.round(value));

    const [value, here] = [...counts].toSorted(
      ([, one], [, other]) => other.length - one.length,
    )[0] ?? [0, []];

    return here.length * 3 >= values.length * 2 ? value : null;
  }

  function emptyRoom(parent: Element, flow: Element[], drawn: Element[]): DiscoveryLead[] {
    return flow.flatMap((child) => {
      const box = child.getBoundingClientRect();
      const style = getComputedStyle(child);

      const holds =
        drawn.length > 0 &&
        !drawn.includes(child) &&
        !declared(child) &&
        style.display !== "contents" &&
        Math.min(box.width, box.height) >= MIN_ROOM &&
        Number(style.flexGrow) === 0 &&
        !child.matches("script, style, template, slot");

      return holds
        ? [
            {
              detail: `${round(box.width)}×${round(box.height)} px in ${name(parent)}`,
              message: `${name(child)} draws nothing and holds room beside what draws`,
              rule: "empty room" as const,
            },
          ]
        : [];
    });
  }

  /** Three or more drawn siblings of one kind, stacked and as wide: a group nobody declared. */
  function inferredGroup(parent: Element, drawn: Element[]): DiscoveryLead[] {
    const [first] = drawn;

    if (!first || drawn.length < MIN_ROWS || !drawn.every((row) => kind(row) === kind(first))) {
      return [];
    }

    const boxes = drawn.map((row) => row.getBoundingClientRect());

    const stacked = boxes.every(
      (box, index) => index === 0 || box.top >= (boxes[index - 1]?.bottom ?? 0) - 1,
    );

    const even = boxes.every((box) => Math.abs(box.width - (boxes[0]?.width ?? 0)) <= WIDTH_SLACK);

    if (!stacked || !even) {
      return [];
    }

    const measures = {
      gap: boxes.slice(1).map((box, index) => box.top - (boxes[index]?.bottom ?? box.top)),
      start: drawn.map((row) => inkBox(row).left),
    };

    return Object.entries(measures).flatMap(([what, values]) => {
      const shared = common(values);

      const odd = values.flatMap((value, index) =>
        shared !== null && Math.abs(value - shared) > 1
          ? [`${name(drawn[what === "gap" ? index + 1 : index] ?? parent)} at ${round(value)}`]
          : [],
      );

      return odd.length > 0
        ? [
            {
              detail: `${odd.join(", ")} where the others are at ${shared}`,
              message: `the ${what} of a row in ${name(parent)} differs from its ${drawn.length - 1} like siblings'`,
              rule: "inferred group" as const,
            },
          ]
        : [];
    });
  }

  return [...document.body.querySelectorAll("*")]
    .filter((parent) => shown(parent) && !(parent instanceof SVGElement) && !declared(parent))
    .flatMap((parent) => {
      const flow = [...parent.children].filter(
        (child) => inFlow(child) && !(child instanceof SVGElement),
      );

      const drawn = flow.filter((child) => inked(child));
      return [...emptyRoom(parent, flow, drawn), ...inferredGroup(parent, drawn)];
    });
}

/** Leads other checks already print, which belong with discovery: cut-off text and what moved. */
export function isDiscovery(finding: Finding) {
  return finding.check === "cut off" || finding.check.startsWith("X3");
}

function discoveryOf(load: LoadReport): AlignmentFinding[] {
  const place = {
    configuration: configurationName(load.alignment.configuration),
    scenario: null,
    screen: load.path,
  };

  return [
    ...load.findings
      .filter((finding) => isDiscovery(finding))
      .map((finding) => ({
        ...place,
        detail: finding.value === undefined ? "" : `${finding.value} ${finding.unit ?? ""}`.trim(),
        level: "discovery" as const,
        message: finding.message,
        piece: "page",
        rule: finding.check,
      })),
    ...load.discovery.map((lead) => ({
      ...place,
      detail: lead.detail,
      level: "discovery" as const,
      message: lead.message,
      piece: "page",
      rule: lead.rule,
    })),
  ];
}

/** A run's alignment: its loads' captures and leads, judged by the one evaluator. */
export function alignmentOfLoads(
  loads: LoadReport[],
): Required<Pick<AlignmentFile, "captures" | "discovery" | "findings">> & { summary: Summary } {
  const file = {
    captures: loads.map((load) => load.alignment),
    discovery: loads.flatMap((load) => discoveryOf(load)),
  };

  return { ...file, ...evaluateFile(file) };
}

export function alignmentSection(findings: AlignmentFinding[]): string[] {
  return [
    "## Alignment",
    "",
    "The shared pieces' declared relationships (`scripts/verify/alignment-table.mts`): what fails, then discovery leads, which never fail, then what wasn't measured. Each fault is listed once with every screen and row it showed on.",
    "",
    ...alignmentLines(findings),
  ];
}
