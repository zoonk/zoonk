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

type Run<T> = { forward: boolean; items: T[]; next?: CoveredMember; previous?: CoveredMember };

/** The nearest covered member past `from`, stepping by `step`, that a different skill teaches. */
function findDistinct({
  covered,
  from,
  step,
}: {
  covered: readonly (CoveredMember | null)[];
  from: number;
  step: 1 | -1;
}): CoveredMember | undefined {
  const position = covered[from]?.first;
  const side = step === 1 ? covered.slice(from + 1) : covered.slice(0, from).toReversed();

  return side.find((member) => member && member.first !== position) ?? undefined;
}

/**
 * A stretch between two covered members follows whichever the graph teaches first. One at an end
 * of the list, or between members one skill teaches together, reads the direction from a neighbor
 * and the next distinct member past it, so a fixed opening skill elsewhere in the graph doesn't flip
 * it.
 */
function isForwardAt({
  covered,
  end,
  start,
}: {
  covered: readonly (CoveredMember | null)[];
  end: number;
  start: number;
}): boolean {
  const previous = covered[start - 1];
  const next = covered[end];

  if (previous && next && previous.first !== next.first) {
    return previous.first < next.first;
  }

  const before = previous && findDistinct({ covered, from: start - 1, step: -1 });

  if (previous && before) {
    return before.first < previous.first;
  }

  const after = next && findDistinct({ covered, from: end, step: 1 });

  return !next || !after || next.first < after.first;
}

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
    const found = covered.findIndex((member, index) => index > start && member !== null);
    const end = found === -1 ? members.length : found;

    return {
      forward: isForwardAt({ covered, end, start }),
      items: members.slice(start, end).map((member) => member.item),
      next: covered[end] ?? undefined,
      previous: covered[start - 1] ?? undefined,
    };
  });
}

function placeRun<T>({ forward, items, next, previous }: Run<T>): MemberPlacement<T>[] {
  const anchor = forward ? previous : next;
  const other = forward ? next : previous;
  const after = anchor ? anchor.last : (other?.first ?? 0) - 1;
  const neighbor = anchor ? anchor.last : (other?.first ?? 0);
  const ordered = forward ? items : items.toReversed();

  return ordered.map((item) => ({ after, item, neighbor }));
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

  return toRuns({ covered, members })
    .flatMap((run) => placeRun(run))
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
