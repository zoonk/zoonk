"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ACTIVITY_BOX_CLASS } from "../_components/activity-canvas";
import { type ModelValues } from "../_utils/formula-model";

type ModelEvent = { label: string; name: string };

/** A what-if is on or off, so it's the kit's switch beside its words. */
function EventToggle({
  disabled,
  isOn,
  label,
  onToggle,
}: {
  disabled: boolean;
  isOn: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        ACTIVITY_BOX_CLASS,
        "flex min-h-11 items-center gap-3 px-3 text-sm font-medium select-none",
      )}
    >
      <Switch checked={isOn} disabled={disabled} onCheckedChange={onToggle} />
      {label}
    </label>
  );
}

export function FormulaModelEvents({
  disabled,
  events,
  onToggle,
  values,
}: {
  disabled: boolean;
  events: readonly ModelEvent[];
  onToggle: (name: string) => void;
  values: ModelValues;
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("What-if events")} className="flex flex-wrap gap-2" role="group">
      {events.map((event) => (
        <EventToggle
          disabled={disabled}
          isOn={values[event.name] === 1}
          key={event.name}
          label={event.label}
          onToggle={() => onToggle(event.name)}
        />
      ))}
    </div>
  );
}

export function FormulaModelLegend({
  activeLabels,
  kind,
}: {
  activeLabels: readonly string[];
  kind: "start" | "whatIf";
}) {
  const t = useExtracted();

  return (
    <div
      aria-hidden="true"
      className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
    >
      <span className="flex items-center gap-1.5">
        <span className="bg-viz-accent h-0.5 w-4 rounded-full" />
        {kind === "whatIf" ? activeLabels.join(", ") : t("Now")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="border-muted-foreground w-4 border-t-2 border-dashed" />
        {kind === "whatIf" ? t("Before") : t("At the start")}
      </span>
    </div>
  );
}
