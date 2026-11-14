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
  /** A column a row keeps empty is a glyph's or a keycap's, never a block's. */
  const SLOT_MAX = 48;
  const { shown } = globalThis.zoonkPage;

  const round = (value: number) => Math.round(value * TENTH) / TENTH;

  const name = (element: Element) => {
    const text = globalThis.zoonkPage.label(element, true).slice(0, LABEL_LENGTH);
    const slot = element instanceof HTMLElement ? element.dataset.slot : undefined;
    return text ? `"${text}"` : `<${element.tagName.toLowerCase()}${slot ? ` ${slot}` : ""}>`;
  };

  const inked = (element: Element) => globalThis.zoonkPage.ink(element) !== null;

  /** Where a row's words start: rows line up by their text, whatever mark or fill comes first. */
  function startOf(element: Element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = [...range.getClientRects()].find((line) => line.width > 0);

      if (rect && node.parentElement && shown(node.parentElement)) {
        return rect.left;
      }
    }

    return globalThis.zoonkPage.ink(element)?.left ?? element.getBoundingClientRect().left;
  }

  /** Where a row's last part ends, when that part is pushed to the row's end half (a value, a chevron). */
  function endOf(row: Element) {
    const box = row.getBoundingClientRect();
    const last = [...row.children].findLast((child) => inked(child));
    const ink = last ? globalThis.zoonkPage.ink(last) : null;
    return ink && ink.left > (box.left + box.right) / 2 ? ink.right : null;
  }

  /**
   * An empty slot as wide as a glyph, a keycap or a drawn element of its own kind in line with it
   * elsewhere is a kept column (`ListRowChevronSpace`, a row past the ninth key), not empty room.
   */
  function keptColumn(slot: Element, box: DOMRect) {
    if (box.width > SLOT_MAX) {
      return false;
    }

    const middle = (box.left + box.right) / 2;

    return [...document.querySelectorAll(`svg, kbd, ${slot.tagName.toLowerCase()}`)].some(
      (other) => {
        const at = other.getBoundingClientRect();

        return (
          other !== slot &&
          Math.abs(at.width - box.width) <= 1 &&
          Math.abs((at.left + at.right) / 2 - middle) <= box.width / 2 &&
          globalThis.zoonkPage.ink(other) !== null
        );
      },
    );
  }

  /** A bar that shows its contents by state (a top bar on scroll) holds its room on purpose. */
  function holdsABar(element: Element) {
    return [element, ...element.querySelectorAll("*")].some((inner) =>
      ["fixed", "sticky"].includes(getComputedStyle(inner).position),
    );
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
        !child.matches("script, style, template, slot") &&
        !keptColumn(child, box) &&
        !holdsABar(child);

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

    type Measured = { row: Element; value: number };

    const measures: Record<string, Measured[]> = {
      end: drawn.flatMap((row) => {
        const end = endOf(row);
        return end === null ? [] : [{ row, value: end }];
      }),
      gap: drawn
        .slice(1)
        .map((row, index) => ({
          row,
          value: (boxes[index + 1]?.top ?? 0) - (boxes[index]?.bottom ?? 0),
        })),
      start: drawn.map((row) => ({ row, value: startOf(row) })),
    };

    return Object.entries(measures).flatMap(([what, rows]) => {
      const shared = rows.length >= MIN_ROWS ? common(rows.map(({ value }) => value)) : null;

      const odd = rows.flatMap(({ row, value }) =>
        shared !== null && Math.abs(value - shared) > 1 ? [`${name(row)} at ${round(value)}`] : [],
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

const BLOCKED_SAVE = " (the walk blocked its save, so this is a failed save)";

/**
 * The walk blocks every write, so each tap that saves shows the same failed save: one lead for
 * what that save moves, with the taps under it.
 */
function discoveryLead(finding: Finding): { detail: string; message: string } {
  const value = finding.value === undefined ? "" : `${finding.value} ${finding.unit ?? ""}`.trim();

  if (!finding.message.endsWith(BLOCKED_SAVE)) {
    return { detail: value, message: finding.message };
  }

  const [tap = "", moved = ""] = finding.message
    .slice(0, -BLOCKED_SAVE.length)
    .split(/: (?<moved>.*)/u);

  const changes = [...new Set(moved.replace(/ and \d+ more$/u, "").split("; "))];

  return {
    detail: tap,
    message: `a failed save (the walk blocks every write) moves ${changes.join("; ")}`,
  };
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
        ...discoveryLead(finding),
        level: "discovery" as const,
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
