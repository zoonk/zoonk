import { ANSWER_TONE } from "@zoonk/learn/answer-tone";

export type Pair = { left: string; right: string };
export type ItemVisualState = "correct" | "idle" | "incorrectFlash" | "selected";
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

export function getItemVisualState({
  correctMatches,
  flashingMatch,
  item,
  selected,
}: {
  correctMatches: MatchAttempt[];
  flashingMatch: MatchAttempt | null;
  item: MatchItemData;
  selected: MatchSelection | null;
}): ItemVisualState {
  if (isItemMatched({ correctMatches, item })) {
    return "correct";
  }

  if (flashingMatch && getAttemptItemId({ attempt: flashingMatch, side: item.side }) === item.id) {
    return "incorrectFlash";
  }

  if (selected && selected.id === item.id) {
    return "selected";
  }

  return "idle";
}

export function getItemClassName(state: ItemVisualState): string {
  if (state === "correct") {
    return `${ANSWER_TONE.right} pointer-events-none`;
  }

  if (state === "incorrectFlash") {
    return ANSWER_TONE.wrong;
  }

  if (state === "selected") {
    return ANSWER_TONE.picked;
  }

  return `${ANSWER_TONE.idle} hover:bg-muted/60`;
}

export function getActiveKeyboardSide(selected: MatchSelection | null): MatchSide {
  if (!selected) {
    return "left";
  }

  return selected.side === "left" ? "right" : "left";
}

export function getKeyboardItems({
  activeKeyboardSide,
  leftItems,
  rightItems,
}: {
  activeKeyboardSide: MatchSide;
  leftItems: MatchItemData[];
  rightItems: MatchItemData[];
}): MatchItemData[] {
  return activeKeyboardSide === "left" ? leftItems : rightItems;
}
