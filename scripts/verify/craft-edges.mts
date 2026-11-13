import { type Finding } from "./checks.mts";
import { type Ink } from "./craft-probe.mts";
import { CRAFT_LINES, lead, names, px } from "./craft-rules.mts";

type Side = "left" | "right";

const SIDE_RULES = { left: "E1", right: "E3" } as const;

function edge(item: Ink, side: Side) {
  return side === "left" ? item.left : item.right;
}

function middle(item: Ink) {
  return (item.top + item.bottom) / 2;
}

function center(item: Ink) {
  return (item.left + item.right) / 2;
}

function overlapsVertically(one: Ink, other: Ink) {
  const overlap = Math.min(one.bottom, other.bottom) - Math.max(one.top, other.top);
  return overlap > Math.min(one.bottom - one.top, other.bottom - other.top) / 2;
}

/** Nothing else in its box sits beside it on that side, so it starts (or ends) its row. */
function outermost(item: Ink, ink: Ink[], side: Side) {
  return !ink.some(
    (other) =>
      other !== item &&
      overlapsVertically(item, other) &&
      (side === "left" ? other.right <= item.left + 1 : other.left >= item.right - 1),
  );
}

/** Craft's "Within": a glyph's ink sits inside its canvas by a different amount for each icon. */
function tolerance(one: Ink, other: Ink) {
  return one.kind === "icon" || other.kind === "icon" ? CRAFT_LINES.glyph : CRAFT_LINES.aligned;
}

function sameEdge(one: Ink, other: Ink, side: Side) {
  return Math.abs(edge(one, side) - edge(other, side)) <= tolerance(one, other);
}

function counts(item: Ink, side: Side) {
  return side === "left" ? item.leftCounts : item.rightCounts;
}

/**
 * Within each box, the vertical lines that several row starts (or ends) share, then each row start
 * near one of them that shares no edge and no center line with anything: the back arrow 18 px right
 * of the title. A box whose contents start on a line (a highlighted row reaching past the column)
 * is placed by its contents, and something reaching its panel's own edge bleeds on purpose.
 */
function sideLeads(ink: Ink[], items: Ink[], side: Side): Finding[] {
  const counted = items.filter((item) => counts(item, side));
  const outer = counted.filter((item) => outermost(item, items, side));
  const frame = ink.find((box) => box.inner !== undefined && box.inner === items[0]?.context);

  const linesNear = (item: Ink, at: number) =>
    outer
      .filter((other) => other !== item)
      .map((other) => ({
        off: at - edge(other, side),
        on: outer.filter((third) => third !== item && sameEdge(third, other, side)),
      }))
      // A line of icons alone is their canvases' blank sides, not an edge.
      .filter(({ on }) => on.length >= 2 && on.some((other) => other.kind !== "icon"));

  const placedByContents = (box: Ink) => {
    const first = ink
      .filter((item) => item.context === box.inner && counts(item, side))
      .toSorted((one, other) =>
        side === "left" ? one.left - other.left : other.right - one.right,
      )[0];

    return (
      first !== undefined &&
      linesNear(box, edge(first, side)).some(({ off, on }) =>
        on.some((other) => Math.abs(off) <= tolerance(first, other)),
      )
    );
  };

  // A row's leading mark lines up by its center with the other marks (E4), not by its ink.
  const judged = outer.filter((item) => item.kind !== "icon" || item.bare || side === "right");

  return judged.flatMap((item) => {
    const bleeds = frame !== undefined && Math.abs(edge(item, side) - edge(frame, side)) <= 1;

    // Icons agreeing with each other are their canvases' blank sides, not an edge.
    const aligned =
      counted.some(
        (other) =>
          other !== item &&
          sameEdge(item, other, side) &&
          (item.kind !== "icon" || other.kind !== "icon"),
      ) ||
      items.filter(
        (other) =>
          other !== item && Math.abs(center(other) - center(item)) <= tolerance(item, other),
      ).length >= 2;

    if (bleeds || aligned || (item.kind === "box" && placedByContents(item))) {
      return [];
    }

    const line = linesNear(item, edge(item, side))
      .filter(
        ({ off, on }) =>
          Math.abs(off) > tolerance(item, on[0] ?? item) && Math.abs(off) <= CRAFT_LINES.nearMiss,
      )
      .toSorted((one, other) => other.on.length - one.on.length)[0];

    if (!line) {
      return [];
    }

    const rule = item.bare ? "E2" : SIDE_RULES[side];
    const verb = side === "left" ? "starts" : "ends";
    const way = line.off > 0 ? "right" : "left";
    const sharing = names(line.on.map((other) => other.label));

    return [
      lead(
        rule,
        `${item.label} ${verb} ${px(Math.abs(line.off))} ${way} of the ${side} edge ${line.on.length} things share (${sharing})`,
        Math.abs(line.off),
      ),
    ];
  });
}

export function edgeLeads(ink: Ink[]): Finding[] {
  return [...Map.groupBy(ink, (item) => item.context).values()].flatMap((items) => [
    ...sideLeads(ink, items, "left"),
    ...sideLeads(ink, items, "right"),
  ]);
}

export function centerLeads(ink: Ink[]): Finding[] {
  const GAP = 16;

  return ink
    .filter((item) => item.kind === "icon")
    .flatMap((icon) => {
      const text = ink.find(
        (other) =>
          other.kind === "text" &&
          other.lines === 1 &&
          other.context === icon.context &&
          overlapsVertically(icon, other) &&
          (Math.abs(other.left - icon.right) <= GAP || Math.abs(icon.left - other.right) <= GAP),
      );

      const off = text ? middle(icon) - middle(text) : 0;

      if (!text || Math.abs(off) <= CRAFT_LINES.offCenter) {
        return [];
      }

      return [
        lead(
          "E5",
          `${icon.label} sits ${px(Math.abs(off))} ${off > 0 ? "below" : "above"} the middle of ${text.label} beside it`,
          Math.abs(off),
        ),
      ];
    });
}
