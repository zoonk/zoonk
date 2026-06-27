export type Pair = { left: string; right: string };
export type ItemVisualState = "correct" | "idle" | "incorrectFlash" | "selected";
export type MatchSide = "left" | "right";
export type MatchItemData = { id: string; label: string; side: MatchSide };
export type MatchSelection = MatchItemData;
export type MatchAttempt = { leftId: string; pair: Pair; rightId: string };

/**
 * Match-column content only stores display labels, and duplicate labels are
 * valid authored content. The player still needs one identity per visible
 * button so solving one duplicate does not lock every duplicate label.
 */
export function buildLeftMatchItems(pairs: Pair[]): MatchItemData[] {
  return pairs.map((pair, index) => ({ id: `left:${index}`, label: pair.left, side: "left" }));
}

/**
 * Right-side labels are already shuffled before they reach the component, so
 * rendered order is the stable identity available to the player.
 */
export function buildRightMatchItems(labels: string[]): MatchItemData[] {
  return labels.map((label, index) => ({ id: `right:${index}`, label, side: "right" }));
}

/**
 * Correct and flashing states belong to a clicked visual item, not every item
 * with the same label. This keeps duplicate labels independent.
 */
function getAttemptItemId({ attempt, side }: { attempt: MatchAttempt; side: MatchSide }): string {
  return side === "left" ? attempt.leftId : attempt.rightId;
}

/**
 * The answer contract still uses labels, while local ids remember which
 * rendered buttons should become locked after a correct match.
 */
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

/**
 * A visible button is matched when its local id was used in a successful pair.
 * Labels are intentionally ignored because duplicate labels need independent
 * state.
 */
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

/**
 * Resolves each visible item into the state used by both styling and locking.
 */
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

/**
 * Keeps the visual-state class mapping beside the state machine so each state
 * has one styling definition.
 */
export function getItemClassName(state: ItemVisualState): string {
  if (state === "correct") {
    return "bg-success/5 border-transparent text-success opacity-75 pointer-events-none";
  }

  if (state === "incorrectFlash") {
    return "border-destructive bg-destructive/5 animate-shake";
  }

  if (state === "selected") {
    return "border-primary bg-primary/5";
  }

  return "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]";
}

/**
 * Number shortcuts control one column at a time. Before a selection they pick
 * from the left column; after a left item is selected, the same numbers pick
 * from the right column, and vice versa for pointer-selected right items.
 */
export function getActiveKeyboardSide(selected: MatchSelection | null): MatchSide {
  if (!selected) {
    return "left";
  }

  return selected.side === "left" ? "right" : "left";
}

/**
 * The active keyboard side determines which list receives visible number
 * badges and which list the keydown handler reads from.
 */
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
