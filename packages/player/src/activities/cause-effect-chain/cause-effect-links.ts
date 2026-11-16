export type Link = { from: string; to: string };

type DatedNode = { id: string; year?: number };

const ARC_BASE = 14;
const ARC_STEP = 7;

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

export function toggleLink(links: readonly Link[], link: Link): Link[] {
  return hasLink(links, link) ? links.filter((item) => !sameLink(item, link)) : [...links, link];
}

export type LinkResult = Link & { state: "correct" | "incorrect" | "missed" };

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
 * How far below its card's middle each arrow ends. Arrows into one card end a head apart, closer when
 * the card is short, and nest instead of crossing: those from above end above those from below, and
 * the farther an arrow comes from, the farther from that side it ends.
 */
export function arcEndOffsets({
  base,
  cards,
  headHeight,
  links,
  order,
}: {
  base: number;
  cards: Readonly<Record<string, { half: number }>>;
  headHeight: number;
  links: readonly Link[];
  order: readonly string[];
}): number[] {
  return links.map((link) => {
    const target = order.indexOf(link.to);
    const distance = (item: Link) => order.indexOf(item.from) - target;
    const side = (item: Link) => (distance(item) > 0 ? 1 : 0);

    const into = links
      .filter((item) => item.to === link.to)
      .toSorted((a, b) => side(a) - side(b) || distance(b) - distance(a));

    if (into.length < 2) {
      return base;
    }

    const room = (cards[link.to]?.half ?? Number.POSITIVE_INFINITY) - base - headHeight / 2;
    const spread = Math.max(0, Math.min(headHeight + 2, room / (into.length - 1)));
    return base + into.indexOf(link) * spread;
  });
}

export function arcPath({
  from,
  gutter,
  headReach = 0,
  span,
  to,
}: {
  from: number;
  gutter: number;
  /** How far the arrowhead's tip reaches past the path's end, so the tip stops at the card. */
  headReach?: number;
  span: number;
  to: number;
}): string {
  const depth = Math.min(ARC_BASE + ARC_STEP * Math.max(span - 1, 0), gutter - 2);
  const bend = gutter - depth;
  return `M${gutter} ${from} C${bend} ${from} ${bend} ${to} ${gutter - headReach} ${to}`;
}
