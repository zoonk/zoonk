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
