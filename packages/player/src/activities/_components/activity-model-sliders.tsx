"use client";

import { useExtracted } from "next-intl";
import { type ModelValues } from "../_utils/formula-model";
import { useFormatNumber } from "../_utils/use-format-number";
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

/**
 * One slider per input of a formula model (calculators, scenarios). Each announces its value and
 * the output it drives, so a screen reader hears the effect of every move.
 */
export function ActivityModelSliders({
  disabled,
  onChange,
  output,
  values,
  variables,
}: {
  disabled: boolean;
  onChange: (name: string, value: number) => void;
  /** The output each move changes, already formatted. */
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
            maxLabel={formatInput(variable.max)}
            min={variable.min}
            minLabel={formatInput(variable.min)}
            onValueChange={(next) => onChange(variable.name, next)}
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
