"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { seededShuffle } from "@zoonk/utils/seeded-random";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { ActivityDragDrop } from "../_components/activity-drag-drop";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { CategorizeChip, type ChipResult } from "./categorize-chip";
import { CategorizeGroup } from "./categorize-group";
import {
  type Placements,
  nextUnplacedId,
  placementsAnswer,
  unplacedItems,
} from "./categorize-placements";
import { CategorizeResults } from "./categorize-results";

type CategorizeProps = ActivityRendererProps<"categorize">;

function chipResult(
  pairs: Record<string, string> | null,
  itemId: string,
  placements: Placements,
): ChipResult {
  if (!pairs) {
    return null;
  }

  return pairs[itemId] === placements[itemId] ? "correct" : "incorrect";
}

/**
 * Sort examples into groups to find the rule that separates them. Tap an item, then its group
 * (or drag it there); every item needs a group before the check. Afterwards each item shows
 * whether it's in the right group, and the misplaced ones say where they belong and why.
 */
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
  const { fields } = content;
  const isChecked = phase === "checked";
  const items = seededShuffle(fields.items, fields.items.map((item) => item.id).join(" "));

  const [placements, setPlacements] = useState<Placements>(() =>
    answer?.kind === "assignment" ? answer.pairs : {},
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const pairs = expectedInteraction(expected, "assignment")?.pairs ?? null;
  const waiting = unplacedItems(items, placements);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const domId = (itemId: string) => `${domPrefix}-${itemId}`;

  function place(itemId: string, groupId: string) {
    const item = items.find((candidate) => candidate.id === itemId);
    const group = fields.groups.find((candidate) => candidate.id === groupId);

    if (isChecked || !item || !group) {
      return;
    }

    const next = { ...placements, [itemId]: groupId };
    const sorted = items.length - unplacedItems(items, next).length;
    const nextId = nextUnplacedId({ items, placedId: itemId, placements: next });

    setPlacements(next);
    setSelectedId(null);
    onAnswerChange(placementsAnswer(items, next));

    setAnnouncement(
      t("{item} is in {group}. {sorted} of {total} sorted.", {
        group: group.label,
        item: item.text,
        sorted: String(sorted),
        total: String(items.length),
      }),
    );

    /* The next item's button is already on the page, so focus moves before the next key. */
    if (nextId) {
      document.querySelector<HTMLElement>(`#${CSS.escape(domId(nextId))}`)?.focus();
    }
  }

  function chipFor(item: (typeof items)[number]) {
    const result = chipResult(pairs, item.id, placements);

    const label = [
      item.text,
      result === "correct" && t("right group"),
      result === "incorrect" && t("wrong group"),
    ]
      .filter(Boolean)
      .join(", ");

    return (
      <CategorizeChip
        disabled={isChecked}
        dragId={item.id}
        id={domId(item.id)}
        isSelected={selectedId === item.id}
        key={item.id}
        label={label}
        onSelect={() => setSelectedId((current) => (current === item.id ? null : item.id))}
        result={result}
        text={item.text}
      />
    );
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <ActivityDragDrop onDrop={place}>
        {!isChecked && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <ActivityCanvasLabel className="font-medium">
                {waiting.length > 0 ? t("To sort") : t("All sorted. Check when you're ready.")}
              </ActivityCanvasLabel>

              <ActivityCanvasLabel className="tabular-nums">
                {t("{sorted} of {total} sorted", {
                  sorted: String(items.length - waiting.length),
                  total: String(items.length),
                })}
              </ActivityCanvasLabel>
            </div>

            {waiting.length > 0 && (
              <div className="grid grid-cols-2 gap-2">{waiting.map((item) => chipFor(item))}</div>
            )}
          </div>
        )}

        <div
          className={cn(
            "grid items-start gap-2.5",
            fields.groups.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2",
          )}
        >
          {fields.groups.map((group) => {
            const inGroup = items.filter((item) => placements[item.id] === group.id);

            return (
              <CategorizeGroup
                group={group}
                isEmpty={inGroup.length === 0}
                key={group.id}
                onPlace={() => selected && place(selected.id, group.id)}
                selectedText={isChecked ? null : (selected?.text ?? null)}
              >
                {inGroup.map((item) => chipFor(item))}
              </CategorizeGroup>
            );
          })}
        </div>
      </ActivityDragDrop>

      {isChecked && pairs && (
        <CategorizeResults
          groups={fields.groups}
          items={items}
          pairs={pairs}
          placements={placements}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ActivityTextAlternative>
        {t(
          "Sort {total} items into {groups}. Pick an item, then pick its group. {sorted} of {total} sorted.",
          {
            groups: fields.groups.map((group) => group.label).join(", "),
            sorted: String(items.length - waiting.length),
            total: String(items.length),
          },
        )}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
