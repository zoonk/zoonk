"use client";

import { Toggle } from "@zoonk/ui/components/toggle";
import { MAX_PROFILE_PICKS } from "./profile-draft";

type ChipOption = { id: string; label: string; pressed: boolean };

function ProfileChip({
  disabled = false,
  label,
  onToggle,
  pressed,
}: Omit<ChipOption, "id"> & { disabled?: boolean; onToggle: () => void }) {
  return (
    <Toggle
      className="aria-pressed:text-foreground text-reading h-auto min-h-11 rounded-lg px-3.5 py-2 text-left whitespace-normal"
      disabled={disabled}
      focusableWhenDisabled
      onPressedChange={onToggle}
      pressed={pressed}
      variant="outline"
    >
      {label}
    </Toggle>
  );
}

export function ProfileChips({
  label,
  onToggle,
  options,
}: {
  label: string;
  onToggle: (id: string) => void;
  options: ChipOption[];
}) {
  const isFull = options.filter((option) => option.pressed).length >= MAX_PROFILE_PICKS;

  return (
    <fieldset className="flex flex-col">
      <legend className="sr-only">{label}</legend>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ProfileChip
            disabled={isFull && !option.pressed}
            key={option.id}
            label={option.label}
            onToggle={() => onToggle(option.id)}
            pressed={option.pressed}
          />
        ))}
      </div>
    </fieldset>
  );
}
