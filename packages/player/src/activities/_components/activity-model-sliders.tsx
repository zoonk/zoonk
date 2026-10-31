"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import { type ModelValues } from "../_utils/formula-model";
import { ActivitySlider } from "./activity-slider";

type Variable = {
  initial: number;
  label: string;
  max: number;
  min: number;
  name: string;
  step: number;
  unit?: string;
};

export function ActivityModelSliders({
  disabled,
  onChange,
  output,
  values,
  variables,
}: {
  disabled: boolean;
  onChange: (name: string, value: number) => void;
  output: { label: string; value: string };
  values: ModelValues;
  variables: readonly Variable[];
}) {
  const t = useExtracted();
  const format = useFormatNumber();

  return (
    <div className="flex flex-col gap-4" data-slot="activity-model-sliders">
      {variables.map((variable) => {
        const value = values[variable.name] ?? variable.initial;
        const formatInput = (input: number) => format(input, { unit: variable.unit });

        return (
          <ActivitySlider
            disabled={disabled}
            key={variable.name}
            label={variable.label}
            max={variable.max}
            min={variable.min}
            onValueChange={(next) => onChange(variable.name, next)}
            scale={
              <div
                aria-hidden="true"
                className="text-muted-foreground flex justify-between text-xs tabular-nums"
              >
                <span>{formatInput(variable.min)}</span>
                <span>{formatInput(variable.max)}</span>
              </div>
            }
            step={variable.step}
            value={value}
            valueLabel={formatInput(value)}
            valueText={t("{input}. {output}: {value}", {
              input: formatInput(value),
              output: output.label,
              value: output.value,
            })}
          />
        );
      })}
    </div>
  );
}
