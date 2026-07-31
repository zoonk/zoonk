"use client";

import { DEFAULT_REASONING, REASONING_OPTIONS, getReasoningLabel } from "@/lib/models";
import { type Reasoning } from "@zoonk/ai/provider-options";
import { Label } from "@zoonk/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zoonk/ui/components/select";

const REASONING_SELECT_ID = "reasoning-level";

/**
 * Formats portable AI SDK reasoning values as readable labels while preserving
 * the exact value submitted to the output-generation Server Action.
 */
export function ReasoningSelect({ reasoning }: { reasoning?: Reasoning }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={REASONING_SELECT_ID}>Reasoning</Label>
      <Select
        defaultValue={reasoning ?? DEFAULT_REASONING}
        itemToStringLabel={getReasoningLabel}
        name="reasoning"
      >
        <SelectTrigger className="min-w-40" id={REASONING_SELECT_ID}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REASONING_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
