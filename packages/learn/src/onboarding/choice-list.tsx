"use client";

import { Label } from "@zoonk/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@zoonk/ui/components/radio-group";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";

export type Choice<Value extends string> = {
  description?: string;
  icon?: React.ReactNode;
  label: string;
  value: Value;
};

const OPTION_CLASS = cn(
  "border-border bg-card flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors motion-reduce:transition-none",
  "hover:bg-muted/60 has-data-checked:border-foreground has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",
  "in-data-[mode=fun]:fun-glass in-data-[mode=fun]:has-data-checked:border-fun-lime",
);

/** One answer from a short list, each option a large row with its own short explanation. */
export function ChoiceList<Value extends string>({
  choices,
  label,
  onChange,
  value,
}: {
  choices: Choice<Value>[];
  label: string;
  onChange: (value: Value) => void;
  value: Value | null;
}) {
  // Number keys pick an option, so the keyboard answers as fast as a tap.
  useNumberKeys({
    count: choices.length,
    onPick: (index) => {
      const choice = choices[index];

      if (choice) {
        onChange(choice.value);
      }
    },
  });

  return (
    <RadioGroup
      aria-label={label}
      className="flex flex-col gap-2"
      onValueChange={(next) => {
        const choice = choices.find((item) => item.value === next);

        if (choice) {
          onChange(choice.value);
        }
      }}
      value={value}
    >
      {choices.map((choice) => (
        <Label className={OPTION_CLASS} key={choice.value}>
          {choice.icon && (
            <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5">
              {choice.icon}
            </span>
          )}

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-medium">{choice.label}</span>
            {choice.description && (
              <span className="text-muted-foreground text-sm font-normal">
                {choice.description}
              </span>
            )}
          </span>

          <RadioGroupItem className="size-5 shrink-0" value={choice.value} />
        </Label>
      ))}
    </RadioGroup>
  );
}
