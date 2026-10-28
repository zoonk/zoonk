"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { useActivityDropTarget } from "../_components/activity-drag-drop";
import { type DiagramSlot } from "./labeled-diagram-model";
import { SpotNumber, type SpotState } from "./spot-number";

function slotState({ isActive, name }: { isActive: boolean; name: string | undefined }): SpotState {
  if (isActive) {
    return "active";
  }

  return name ? "filled" : "empty";
}

function SpotPlace({ isEmpty, number }: { isEmpty: boolean; number: string }) {
  const t = useExtracted();

  return (
    <span className="sr-only">
      {isEmpty ? t("Spot {number}: empty", { number }) : t("Spot {number}:", { number })}
    </span>
  );
}

function SlotButton({
  isActive,
  name,
  onSelect,
  slot,
}: {
  isActive: boolean;
  name: string | undefined;
  onSelect: () => void;
  slot: DiagramSlot;
}) {
  const t = useExtracted();
  const { dropRef, isOver } = useActivityDropTarget({ id: `slot:${slot.key}` });
  const number = String(slot.number);

  return (
    <button
      aria-pressed={isActive}
      className={cn(
        "focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-3 rounded-xl border px-2.5 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px] motion-safe:transition-[border-color,box-shadow,background-color]",
        !name && !isActive && "border-dashed",
        name && "bg-background hover:bg-accent",
        isActive && "border-viz-accent bg-viz-accent-soft/40 ring-viz-accent/20 ring-2",
        isOver && "border-viz-accent ring-viz-accent/30 ring-4",
      )}
      onClick={onSelect}
      ref={dropRef}
      type="button"
    >
      <SpotPlace isEmpty={!name && !isActive} number={number} />
      <SpotNumber number={slot.number} state={slotState({ isActive, name })} />

      {name ? (
        <>
          <span className="min-w-0 flex-1 font-medium">{name}</span>
          <X aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        </>
      ) : (
        <span className="text-muted-foreground">{isActive ? t("Pick a name") : null}</span>
      )}
    </button>
  );
}

function CheckedSlot({
  correct,
  mixUp,
  name,
  slot,
}: {
  correct: boolean;
  mixUp: string | null;
  name: string | undefined;
  slot: DiagramSlot;
}) {
  const t = useExtracted();
  const state: SpotState = correct ? "correct" : "incorrect";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border px-2.5 py-2 text-sm",
        correct ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5",
      )}
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SpotNumber number={slot.number} state={state} />
        {correct && <span className="font-medium">{slot.label}</span>}
        {correct && <Check aria-hidden="true" className="text-success-text size-4" />}

        {!correct && name && (
          <span className="text-muted-foreground line-through">
            <span className="sr-only">{t("Your answer:")} </span>
            {name}
          </span>
        )}

        {!correct && (
          <span className="text-success-text font-medium">
            <span className="sr-only">{t("Correct answer:")} </span>
            {slot.label}
          </span>
        )}
      </p>

      {mixUp && <p className="text-muted-foreground ps-9 leading-snug">{mixUp}</p>}
    </div>
  );
}

export function DiagramSlots({
  activeKey,
  checked,
  onSelect,
  placements,
  slots,
}: {
  activeKey: string | null;
  checked: ReadonlyMap<string, string | null> | null;
  onSelect: (key: string) => void;
  placements: Readonly<Record<string, string>>;
  slots: readonly DiagramSlot[];
}) {
  const t = useExtracted();

  return (
    <ol aria-label={t("Spots to label")} className="flex flex-col gap-2">
      {slots.map((slot) => (
        <li key={slot.key}>
          {checked ? (
            <CheckedSlot
              correct={placements[slot.key] === slot.label}
              mixUp={checked.get(slot.key) ?? null}
              name={placements[slot.key]}
              slot={slot}
            />
          ) : (
            <SlotButton
              isActive={activeKey === slot.key}
              name={placements[slot.key]}
              onSelect={() => onSelect(slot.key)}
              slot={slot}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
