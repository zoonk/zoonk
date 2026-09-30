export type Link = { from: string; to: string };

type DatedNode = { id: string; year?: number };

const ARC_BASE = 14;
const ARC_STEP = 7;

/**
 * Nodes top to bottom in time when every one has a date, so causes tend to sit above their
 * effects without giving away which links exist; otherwise in the writer's order.
 */
export function orderNodes<TNode extends DatedNode>(nodes: readonly TNode[]): TNode[] {
  const allDated = nodes.every((node) => node.year !== undefined);
  return allDated ? nodes.toSorted((a, b) => (a.year ?? 0) - (b.year ?? 0)) : [...nodes];
}

export function sameLink(first: Link, second: Link): boolean {
  return first.from === second.from && first.to === second.to;
}

export function hasLink(links: readonly Link[], link: Link): boolean {
  return links.some((item) => sameLink(item, link));
}

/** Adds a link, or removes it when it's already there. */
export function toggleLink(links: readonly Link[], link: Link): Link[] {
  return hasLink(links, link) ? links.filter((item) => !sameLink(item, link)) : [...links, link];
}

export type LinkResult = Link & { state: "correct" | "incorrect" | "missed" };

/** The learner's links next to the expected ones: right, wrong, and the ones they missed. */
export function compareLinks(learner: readonly Link[], expected: readonly Link[]): LinkResult[] {
  return [
    ...learner.map((link) => ({
      ...link,
      state: hasLink(expected, link) ? ("correct" as const) : ("incorrect" as const),
    })),
    ...expected
      .filter((link) => !hasLink(learner, link))
      .map((link) => ({ ...link, state: "missed" as const })),
  ];
}

/**
 * An arrow between two cards stacked in a column, bowing into the gutter on their left: the
 * further apart the cards, the wider the bow, so arcs nest instead of crossing.
 */
export function arcPath({
  from,
  gutter,
  span,
  to,
}: {
  from: number;
  gutter: number;
  span: number;
  to: number;
}): string {
  const depth = Math.min(ARC_BASE + ARC_STEP * Math.max(span - 1, 0), gutter - 2);
  const bend = gutter - depth;
  return `M${gutter} ${from} C${bend} ${from} ${bend} ${to} ${gutter} ${to}`;
}
