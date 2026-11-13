import { LabeledSelect } from "@/components/labeled-select";
import { DEFAULT_REASONING, REASONING_OPTIONS } from "@/lib/models";
import { type Reasoning } from "@zoonk/ai/provider-options";

export function ReasoningSelect({ reasoning }: { reasoning?: Reasoning }) {
  return (
    <LabeledSelect
      defaultValue={reasoning ?? DEFAULT_REASONING}
      id="reasoning-level"
      label="Reasoning"
      name="reasoning"
      options={REASONING_OPTIONS}
      size="md"
      triggerClassName="min-w-40"
    />
  );
}
