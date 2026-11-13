import { type MatchEntryState } from "@zoonk/learn/match-entry";

export type Pair = { left: string; right: string };
export type MatchSide = "left" | "right";
export type MatchItemData = { id: string; label: string; side: MatchSide };
export type MatchSelection = MatchItemData;
export type MatchAttempt = { leftId: string; pair: Pair; rightId: string };

export function buildLeftMatchItems(pairs: Pair[]): MatchItemData[] {
  return pairs.map((pair, index) => ({ id: `left:${index}`, label: pair.left, side: "left" }));
}

export function buildRightMatchItems(labels: string[]): MatchItemData[] {
  return labels.map((label, index) => ({ id: `right:${index}`, label, side: "right" }));
}

export function buildSolvedMatchBoard(pairs: Pair[]): {
  matches: MatchAttempt[];
  rightItems: MatchItemData[];
} {
  return {
    matches: pairs.map((pair, index) => ({
      leftId: `left:${index}`,
      pair,
      rightId: `right:${index}`,
    })),
    rightItems: buildRightMatchItems(pairs.map((pair) => pair.right)),
  };
}

function getAttemptItemId({ attempt, side }: { attempt: MatchAttempt; side: MatchSide }): string {
  return side === "left" ? attempt.leftId : attempt.rightId;
}

export function buildMatchAttempt({
  current,
  selected,
}: {
  current: MatchSelection;
  selected: MatchSelection;
}): MatchAttempt {
  if (current.side === "left") {
    return {
      leftId: current.id,
      pair: { left: current.label, right: selected.label },
      rightId: selected.id,
    };
  }

  return {
    leftId: selected.id,
    pair: { left: selected.label, right: current.label },
    rightId: current.id,
  };
}

export function restoreMatches({
  leftItems,
  pairs,
  rightItems,
}: {
  leftItems: MatchItemData[];
  pairs: Pair[];
  rightItems: MatchItemData[];
}): MatchAttempt[] {
  return pairs.flatMap((pair) => {
    const left = leftItems.find((item) => item.label === pair.left);
    const right = rightItems.find((item) => item.label === pair.right);
    return left && right ? [{ leftId: left.id, pair, rightId: right.id }] : [];
  });
}

export function isItemMatched({
  correctMatches,
  item,
}: {
  correctMatches: MatchAttempt[];
  item: MatchItemData;
}): boolean {
  return correctMatches.some(
    (match) => getAttemptItemId({ attempt: match, side: item.side }) === item.id,
  );
}

/** The place of the left entry of the pair `item` is in: the number both of its entries show. */
export function getPairIndex({
  correctMatches,
  item,
  leftItems,
}: {
  correctMatches: MatchAttempt[];
  item: MatchItemData;
  leftItems: MatchItemData[];
}): number | undefined {
  const match = correctMatches.find(
    (attempt) => getAttemptItemId({ attempt, side: item.side }) === item.id,
  );

  const index = leftItems.findIndex((left) => left.id === match?.leftId);
  return index === -1 ? undefined : index;
}

export function getEntryState({
  correctMatches,
  flashingMatch,
  item,
  selected,
}: {
  correctMatches: MatchAttempt[];
  flashingMatch: MatchAttempt | null;
  item: MatchItemData;
  selected: MatchSelection | null;
}): MatchEntryState {
  if (isItemMatched({ correctMatches, item })) {
    return "right";
  }

  if (flashingMatch && getAttemptItemId({ attempt: flashingMatch, side: item.side }) === item.id) {
    return "wrong";
  }

  if (selected && selected.id === item.id) {
    return "selected";
  }

  return "idle";
}
