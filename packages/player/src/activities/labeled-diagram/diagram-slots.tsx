"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { useActivityDropTarget } from "../_components/activity-drag-drop";
import { type PinState, SpotNumber } from "./diagram-figure";
import { type DiagramSlot } from "./labeled-diagram-model";
import { useSpotPosition } from "./use-diagram-words";

function slotState({ isActive, name }: { isActive: boolean; name: string | undefined }): PinState {
  if (isActive) {
    return "active";
  }

  return name ? "filled" : "empty";
}

/** A spot to fill: tap it to make it the one names go to, or to take its name back off. */
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
  const positionOf = useSpotPosition();
  const { dropRef, isOver } = useActivityDropTarget({ id: `slot:${slot.partId}` });
  const position = positionOf(slot.position);
  const number = String(slot.number);

  return (
    <button
      aria-label={
        name
          ? t("Spot {number}, {position}: {name}", { name, number, position })
          : t("Spot {number}, {position}: empty", { number, position })
      }
      aria-pressed={isActive}
      className={cn(
        "focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-3 rounded-2xl border px-2.5 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px] motion-safe:transition-[border-color,box-shadow,background-color]",
        !name && !isActive && "border-dashed",
        name && "bg-background hover:bg-accent",
        isActive && "border-viz-accent bg-viz-accent-soft/40 ring-viz-accent/20 ring-2",
        isOver && "border-viz-accent ring-viz-accent/30 ring-4",
      )}
      onClick={onSelect}
      ref={dropRef}
      type="button"
    >
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

/** A spot after the check: the learner's name, right or wrong, the right one and the mix-up why. */
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
  const state: PinState = correct ? "correct" : "incorrect";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl border px-2.5 py-2 text-sm",
        correct ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5",
      )}
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SpotNumber number={slot.number} state={state} />
        {correct && <span className="font-medium">{slot.label}</span>}
        {correct && <Check aria-hidden="true" className="text-success size-4" />}

        {!correct && name && (
          <span className="text-muted-foreground line-through">
            <span className="sr-only">{t("Your answer:")} </span>
            {name}
          </span>
        )}

        {!correct && (
          <span className="text-success font-medium">
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
  activePartId,
  checked,
  onSelect,
  placements,
  slots,
}: {
  activePartId: string | null;
  /** Once checked, each spot's mix-up feedback (or null); null while answering. */
  checked: ReadonlyMap<string, string | null> | null;
  onSelect: (partId: string) => void;
  placements: Readonly<Record<string, string>>;
  slots: readonly DiagramSlot[];
}) {
  const t = useExtracted();

  return (
    <ol aria-label={t("Spots to label")} className="flex flex-col gap-2">
      {slots.map((slot) => (
        <li key={slot.partId}>
          {checked ? (
            <CheckedSlot
              correct={placements[slot.partId] === slot.label}
              mixUp={checked.get(slot.partId) ?? null}
              name={placements[slot.partId]}
              slot={slot}
            />
          ) : (
            <SlotButton
              isActive={activePartId === slot.partId}
              name={placements[slot.partId]}
              onSelect={() => onSelect(slot.partId)}
              slot={slot}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
