"use client";

import { Button } from "@zoonk/ui/components/button";
import { Undo2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { type BalanceMove, type BalanceState, type PanSide } from "./balance-model";

type BalanceObjects = {
  unit: { label: string; symbol: string };
  unknown: { label: string; symbol: string };
};

function PanControls({
  label,
  objects,
  onMove,
  side,
  state,
}: {
  label: string;
  objects: BalanceObjects;
  onMove: (move: BalanceMove) => void;
  side: PanSide;
  state: BalanceState;
}) {
  const t = useExtracted();
  const pan = state[side];

  const takeLabel = (object: string) =>
    side === "left"
      ? t("Take off the left side: {object}", { object })
      : t("Take off the right side: {object}", { object });

  return (
    <div aria-label={label} className="flex flex-col gap-1.5" role="group">
      <span className="text-muted-foreground text-xs">{label}</span>

      <div className="flex gap-2">
        <Button
          aria-label={takeLabel(objects.unknown.label)}
          className="flex-1 tabular-nums"
          disabled={pan.x < 1}
          onClick={() => onMove({ kind: "takeX", side })}
          size="lg"
          variant="outline"
        >
          {`−${objects.unknown.symbol}`}
        </Button>

        <Button
          aria-label={takeLabel(objects.unit.label)}
          className="flex-1 tabular-nums"
          disabled={pan.units < 1}
          onClick={() => onMove({ kind: "takeUnit", side })}
          size="lg"
          variant="outline"
        >
          {`−${objects.unit.symbol}`}
        </Button>
      </div>
    </div>
  );
}

/**
 * The learner's hands: take an unknown or a unit off either pan, split both pans into equal
 * groups once the unknowns stand alone, and undo. Taking from one pan only is allowed on purpose:
 * the beam tips, which is how "do the same to both sides" gets felt before it's a rule.
 */
export function BalanceControls({
  canUndo,
  objects,
  onMove,
  onUndo,
  splitGroups,
  state,
}: {
  canUndo: boolean;
  objects: BalanceObjects;
  onMove: (move: BalanceMove) => void;
  onUndo: () => void;
  splitGroups: number | null;
  state: BalanceState;
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3" data-slot="balance-controls">
      <div className="grid grid-cols-2 gap-3">
        <PanControls
          label={t("Left side")}
          objects={objects}
          onMove={onMove}
          side="left"
          state={state}
        />
        <PanControls
          label={t("Right side")}
          objects={objects}
          onMove={onMove}
          side="right"
          state={state}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {splitGroups !== null && (
          <Button
            onClick={() => onMove({ groups: splitGroups, kind: "split" })}
            size="lg"
            variant="secondary"
          >
            {t("Split both sides into {count} equal groups", { count: String(splitGroups) })}
          </Button>
        )}

        <Button disabled={!canUndo} onClick={onUndo} size="lg" variant="outline">
          <Undo2 aria-hidden="true" />
          {t("Undo")}
        </Button>
      </div>
    </div>
  );
}
