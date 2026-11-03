"use client";

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
import {
  type SortState,
  placementsAnswer,
  sortCard,
  takeBackLastCard,
  unplacedItems,
} from "./categorize-placements";
import { CategorizeSorted } from "./categorize-sorted";
import { CategorizeSorting } from "./categorize-sorting";

type CategorizeProps = ActivityRendererProps<"categorize">;

function CategorizeTextAlternative({
  groups,
  total,
}: {
  groups: readonly { label: string }[];
  total: number;
}) {
  const t = useExtracted();

  return (
    <ActivityTextAlternative>
      {t("Sort {total, plural, one {# card} other {# cards}} into {groups}, one at a time.", {
        groups: groups.map((group) => group.label).join(", "),
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
  const t = useExtracted();
  const domPrefix = useId();
  const interactionState = usePlayerInteractionState();
  const { groups } = content.fields;
  const isChecked = phase === "checked";

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
      commit(
        next,
        t({
          description:
            "Read by screen readers after a card is sorted; {next} is the card to sort now.",
          message: "{item} is in {group}. Next: {next}.",
          values: { group: group.label, item: card.text, next: nextCard.text },
        }),
      );

      return;
    }

    const hadFocus =
      document.activeElement === undoRef.current ||
      (groupsRef.current?.contains(document.activeElement) ?? false);

    flushSync(() =>
      commit(next, t("{item} is in {group}.", { group: group.label, item: card.text })),
    );

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

    flushSync(() =>
      commit(
        next,
        t({
          description: "Read by screen readers after Undo: this card is back to be sorted again.",
          message: "Took back {item}.",
          values: { item: taken.text },
        }),
      ),
    );

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

    flushSync(() =>
      commit(next, t("{item} is in {group}.", { group: group.label, item: item.text })),
    );

    document.querySelector<HTMLElement>(`#${CSS.escape(rowId(itemId))}`)?.focus();
  }

  function drop(itemId: string, groupId: string) {
    if (!card) {
      move(itemId, groupId);
    } else if (itemId === card.id) {
      sort(groupId);
    }
  }

  useNumberKeys({
    count: groups.length,
    enabled: card !== null && interactionState !== "paused",
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
      <ActivityDragDrop onDrop={drop} underPointerOnly>
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
