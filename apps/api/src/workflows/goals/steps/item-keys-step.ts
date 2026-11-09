import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { type GeneratedItem, type OptionSelect } from "@zoonk/ai/tasks/items/schemas";
import { checkItemKeys } from "@zoonk/core/library/items/check-keys";

export async function checkItemKeysStep<Item extends GeneratedItem>({
  wait,
  ...input
}: {
  analytics: AiGenerationContext;
  items: Item[];
  language: string;
  optionCount?: number | null;
  optionLanguage?: string | null;
  select?: OptionSelect;
  wait: CallWait;
}) {
  "use step";

  return checkItemKeys({ ...input, serviceTier: chooseServiceTier({ wait }) });
}
