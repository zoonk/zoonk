/** A member of a complete list, in the list's order, with the graph skills that teach it. */
type ListedMember<T> = { item: T; skills: readonly string[] };

export type MemberPlacement<T> = {
  item: T;
  /** The graph position it goes after; -1 is before the first skill. */
  after: number;
  /** The position of the skill whose phase, area, course and level it takes. */
  neighbor: number;
};

type CoveredMember = { first: number; last: number };

type Run<T> = { items: T[]; next?: CoveredMember; previous?: CoveredMember };

/** Each stretch of members no skill teaches, with the covered members on either side. */
function toRuns<T>({
  covered,
  members,
}: {
  covered: readonly (CoveredMember | null)[];
  members: readonly ListedMember<T>[];
}): Run<T>[] {
  const starts = members.flatMap((_, index) =>
    !covered[index] && (index === 0 || covered[index - 1]) ? [index] : [],
  );

  return starts.map((start) => {
    const end = covered.findIndex((member, index) => index > start && member !== null);

    return {
      items: members.slice(start, end === -1 ? undefined : end).map((member) => member.item),
      next: covered[end] ?? undefined,
      previous: covered[start - 1] ?? undefined,
    };
  });
}

/**
 * The graph teaches the list forward when its first covered member comes before its last, so a gap
 * at either end of the list goes on the side that direction implies.
 */
function isForward(covered: readonly (CoveredMember | null)[]): boolean {
  const listed = covered.filter((member) => member !== null);
  return (listed[0]?.first ?? 0) <= (listed.at(-1)?.first ?? 0);
}

function placeRun<T>({ forward, run }: { forward: boolean; run: Run<T> }): MemberPlacement<T>[] {
  const { next, previous } = run;

  // Between two covered members, it follows whichever the graph teaches first.
  const forwardHere = previous && next ? previous.first <= next.first : forward;
  const anchor = forwardHere ? previous : next;
  const other = forwardHere ? next : previous;
  const after = anchor ? anchor.last : (other?.first ?? 0) - 1;
  const neighbor = anchor ? anchor.last : (other?.first ?? 0);
  const items = forwardHere ? run.items : run.items.toReversed();

  return items.map((item) => ({ after, item, neighbor }));
}

/**
 * Where each member no skill in `order` teaches goes, in teaching order: next to its nearest covered
 * neighbor in the list, on the side the graph teaches the list in. With no member covered, the
 * members go after the last skill in the list's order. @internal
 */
export function placeUncoveredMembers<T>({
  members,
  order,
}: {
  members: readonly ListedMember<T>[];
  order: readonly string[];
}): MemberPlacement<T>[] {
  const covered = members.map((member): CoveredMember | null => {
    const positions = member.skills.map((skill) => order.indexOf(skill)).filter((at) => at >= 0);

    return positions.length > 0
      ? { first: Math.min(...positions), last: Math.max(...positions) }
      : null;
  });

  if (covered.every((member) => member === null)) {
    const last = order.length - 1;
    return members.map((member) => ({ after: last, item: member.item, neighbor: last }));
  }

  const forward = isForward(covered);

  return toRuns({ covered, members })
    .flatMap((run) => placeRun({ forward, run }))
    .toSorted((a, b) => a.after - b.after);
}

/** Where each member of `uncovered` goes, given every member of the list and the skills they map to. */
export function placeUncoveredOf<T extends { number: number }>({
  members,
  order,
  uncovered,
}: {
  members: readonly { number: number; skills: readonly string[] }[];
  order: readonly string[];
  uncovered: readonly T[];
}): MemberPlacement<T>[] {
  const byNumber = new Map(uncovered.map((member) => [member.number, member]));

  return placeUncoveredMembers({
    members: members.map((member) => ({ item: member.number, skills: member.skills })),
    order,
  }).flatMap((placement) => {
    const member = byNumber.get(placement.item);
    return member ? [{ ...placement, item: member }] : [];
  });
}
