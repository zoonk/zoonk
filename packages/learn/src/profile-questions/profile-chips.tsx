"use client";

import { Button } from "@zoonk/ui/components/button";
import { Toggle } from "@zoonk/ui/components/toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";

type ChipOption = { id: string; label: string; pressed: boolean };

const CHIP_CLASS = "text-reading min-h-control h-auto rounded-lg px-3.5 py-2 text-left";

function ProfileChip({
  label,
  onToggle,
  pressed,
}: Omit<ChipOption, "id"> & { onToggle: () => void }) {
  return (
    <Toggle
      className={cn(CHIP_CLASS, "aria-pressed:text-foreground whitespace-normal")}
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
    </fieldset>
  );
}

/** What the learner typed, each as a picked chip they can remove. */
export function TypedChips({
  items,
  onRemove,
}: {
  items: string[];
  onRemove: (item: string) => void;
}) {
  const t = useExtracted();

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          className={cn(
            CHIP_CLASS,
            "bg-selected-tint text-foreground contrast-more:border-input flex max-w-full items-center gap-1 border border-transparent py-0 pr-1 forced-colors:border-[Highlight]",
          )}
          key={item}
        >
          <span className="min-w-0 py-2 wrap-break-word">{item}</span>
          <Button
            aria-label={t({
              description:
                "Removes a tool the learner typed. {tool} is its name, such as Photoshop.",
              message: "Remove {tool}",
              values: { tool: item },
            })}
            className="shrink-0"
            icon={<XIcon aria-hidden="true" />}
            onClick={() => onRemove(item)}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        </li>
      ))}
    </ul>
  );
}
