"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ModelValues } from "../_utils/formula-model";

type ModelEvent = { label: string; name: string };

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
  const Icon = isOn ? Check : Plus;

  return (
    <button
      aria-pressed={isOn}
      className={cn(
        "focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-[3px] motion-safe:transition-colors",
        isOn
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-accent",
      )}
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
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

export function FormulaModelLegend({ kind }: { kind: "start" | "whatIf" }) {
  const t = useExtracted();

  return (
    <div
      aria-hidden="true"
      className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
    >
      <span className="flex items-center gap-1.5">
        <span className="bg-viz-accent h-0.5 w-4 rounded-full" />
        {kind === "whatIf" ? t("With the what-ifs") : t("Now")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="border-muted-foreground w-4 border-t-2 border-dashed" />
        {kind === "whatIf" ? t("Before") : t("At the start")}
      </span>
    </div>
  );
}
