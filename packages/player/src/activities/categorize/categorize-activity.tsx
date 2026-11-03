"use client";

import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { seededShuffle } from "@zoonk/utils/seeded-random";
import { useExtracted } from "next-intl";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePlayerInteractionState } from "../../player-context";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivityDragDrop } from "../_components/activity-drag-drop";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { handDragId, rowDragItem } from "./categorize-drag-ids";
import {
  type SortState,
  placementsAnswer,
  sortCard,
  takeBackLastCard,
  unplacedItems,
} from "./categorize-placements";
import { CategorizeSorted } from "./categorize-sorted";
import { CategorizeSorting } from "./categorize-sorting";
import { useSortAnnouncements } from "./use-sort-announcements";

type CategorizeProps = ActivityRendererProps<"categorize">;

function CategorizeTextAlternative({
  groups,
  total,
}: {
  groups: readonly { label: string }[];
  total: number;
}) {
  const t = useExtracted();
  const spoken = useSpokenText();

  return (
    <ActivityTextAlternative>
      {t("Sort {total, plural, one {# card} other {# cards}} into {groups}, one at a time.", {
        groups: groups.map((group) => spoken.inline(group.label)).join(", "),
        total,
      })}
    </ActivityTextAlternative>
  );
}

export function CategorizeActivity({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: CategorizeProps) {
  const announce = useSortAnnouncements();
  const domPrefix = useId();
  const interactionState = usePlayerInteractionState();
  const { groups } = content.fields;
  const isChecked = phase === "checked";
  const isInteractive = !isChecked && interactionState !== "paused";

  const items = seededShuffle(
    content.fields.items,
    content.fields.items.map((item) => item.id).join(" "),
  );

  const [state, setState] = useState<SortState>(() => ({
    history: [],
    placements: answer?.kind === "assignment" ? answer.pairs : {},
  }));

  const [announcement, setAnnouncement] = useState("");
  const groupsRef = useRef<HTMLDivElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const card = isChecked ? null : (unplacedItems(items, state.placements)[0] ?? null);
  const rowId = (itemId: string) => `${domPrefix}-${itemId}`;

  function commit(next: SortState, message: string) {
    setState(next);
    setAnnouncement(message);
    onAnswerChange(placementsAnswer(items, next.placements));
  }

  function sort(groupId: string) {
    const group = groups.find((candidate) => candidate.id === groupId);

    if (!card || !group) {
      return;
    }

    const next = sortCard({ groupId, itemId: card.id, state });
    const nextCard = unplacedItems(items, next.placements)[0];

    if (nextCard) {
      commit(next, announce.placedWithNext({ card, group, next: nextCard }));

      return;
    }

    const hadFocus =
      document.activeElement === undoRef.current ||
      (groupsRef.current?.contains(document.activeElement) ?? false);

    flushSync(() => commit(next, announce.placed(card, group)));

    if (hadFocus) {
      statusRef.current?.focus();
    }
  }

  function undo() {
    const taken = items.find((item) => item.id === state.history.at(-1));

    if (!taken) {
      return;
    }

    const next = takeBackLastCard(state);
    const hadFocus = document.activeElement === undoRef.current;

    flushSync(() => commit(next, announce.tookBack(taken)));

    if (hadFocus && next.history.length === 0) {
      groupsRef.current?.querySelector("button")?.focus();
    }
  }

  function move(itemId: string, groupId: string) {
    const item = items.find((candidate) => candidate.id === itemId);
    const group = groups.find((candidate) => candidate.id === groupId);

    if (!item || !group) {
      return;
    }

    const next = { ...state, placements: { ...state.placements, [itemId]: groupId } };

    flushSync(() => commit(next, announce.placed(item, group)));

    document.querySelector<HTMLElement>(`#${CSS.escape(rowId(itemId))}`)?.focus();
  }

  function drop(dragId: string, groupId: string) {
    const rowItem = rowDragItem(dragId);

    if (rowItem) {
      move(rowItem, groupId);
    } else if (card && dragId === handDragId(card.id)) {
      sort(groupId);
    }
  }

  useNumberKeys({
    count: groups.length,
    enabled: card !== null && isInteractive,
    onPick: (index) => {
      const group = groups[index];

      if (!group) {
        return false;
      }

      sort(group.id);
    },
  });

  return (
    <ActivityCanvas labelId={labelId}>
      <ActivityDragDrop disabled={!isInteractive} onDrop={drop} underPointerOnly>
        {card ? (
          <CategorizeSorting
            card={card}
            groups={groups}
            groupsRef={groupsRef}
            items={items}
            onSort={sort}
            onUndo={undo}
            state={state}
            undoRef={undoRef}
          />
        ) : (
          <CategorizeSorted
            checkedPairs={
              isChecked ? (expectedInteraction(expected, "assignment")?.pairs ?? null) : null
            }
            groups={groups}
            items={items}
            onMove={move}
            placements={state.placements}
            rowId={rowId}
            statusRef={statusRef}
          />
        )}
      </ActivityDragDrop>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <CategorizeTextAlternative groups={groups} total={items.length} />
    </ActivityCanvas>
  );
}
