"use client";

import { Toggle } from "@zoonk/ui/components/toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";

type ChipOption = { id: string; label: string; pressed: boolean };

export function ProfileChip({
  label,
  onToggle,
  pressed,
}: Omit<ChipOption, "id"> & { onToggle: () => void }) {
  return (
    <Toggle
      className="aria-pressed:text-foreground text-reading h-auto min-h-11 rounded-lg px-3.5 py-2 text-left whitespace-normal"
      onPressedChange={onToggle}
      pressed={pressed}
      variant="outline"
    >
      {pressed && <CheckIcon aria-hidden="true" />}
      {label}
    </Toggle>
  );
}

/** The cap line stays mounted while empty, so it's heard when a fourth pick brings it. */
export function ProfileChips({
  capped,
  label,
  onToggle,
  options,
}: {
  capped: boolean;
  label: string;
  onToggle: (id: string) => void;
  options: ChipOption[];
}) {
  const t = useExtracted();

  return (
    <fieldset className="flex flex-col">
      <legend className="sr-only">{label}</legend>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ProfileChip
            key={option.id}
            label={option.label}
            onToggle={() => onToggle(option.id)}
            pressed={option.pressed}
          />
        ))}
      </div>

      <p aria-live="polite" className={cn("text-muted-foreground text-sm", capped && "mt-3")}>
        {capped && t("Pick up to 3.")}
      </p>
    </fieldset>
  );
}
