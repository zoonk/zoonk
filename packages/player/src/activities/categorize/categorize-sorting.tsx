"use client";

import { Button } from "@zoonk/ui/components/button";
import { Undo2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import { CategorizeCard } from "./categorize-card";
import { CategorizeGroupOption } from "./categorize-group";
import { type SortState, unplacedItems } from "./categorize-placements";

type Item = { id: string; text: string };
type Group = { id: string; label: string; rule: string };

function groupPreview({
  groupId,
  items,
  state,
}: {
  groupId: string;
  items: readonly Item[];
  state: SortState;
}) {
  const sortedHere = state.history.filter((itemId) => state.placements[itemId] === groupId);
  const latest = items.find((item) => item.id === sortedHere.at(-1));

  return { latest: latest?.text ?? null, others: Math.max(sortedHere.length - 1, 0) };
}

export function CategorizeSorting({
  card,
  groups,
  groupsRef,
  items,
  onSort,
  onUndo,
  state,
  undoRef,
}: {
  card: Item;
  groups: readonly Group[];
  groupsRef: React.Ref<HTMLDivElement>;
  items: readonly Item[];
  onSort: (groupId: string) => void;
  onUndo: () => void;
  state: SortState;
  undoRef: React.Ref<HTMLButtonElement>;
}) {
  const t = useExtracted();
  const askId = useId();

  return (
    <>
      <ActivityCanvasLabel className="tabular-nums">
        {t({
          description: "Progress while sorting: how many of the cards already have a group.",
          message: "{sorted} of {total} sorted",
          values: {
            sorted: String(items.length - unplacedItems(items, state.placements).length),
            total: String(items.length),
          },
        })}
      </ActivityCanvasLabel>

      <CategorizeCard cardId={card.id} items={items} />

      <div className="flex min-h-7.5 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-muted-foreground text-[0.8125rem]" id={askId}>
          {t({
            description: "Under the card being sorted, above the groups to choose from.",
            message: "Which group does it belong in?",
          })}
        </p>

        {state.history.length > 0 && (
          <Button className="-mr-2.5" onClick={onUndo} ref={undoRef} size="sm" variant="ghost">
            <Undo2 aria-hidden="true" />
            {t("Undo")}
          </Button>
        )}
      </div>

      <div aria-labelledby={askId} className="flex flex-col gap-2.5" ref={groupsRef} role="group">
        {groups.map((group, index) => (
          <CategorizeGroupOption
            group={group}
            index={index}
            key={group.id}
            onSort={() => onSort(group.id)}
            {...groupPreview({ groupId: group.id, items, state })}
          />
        ))}
      </div>
    </>
  );
}
