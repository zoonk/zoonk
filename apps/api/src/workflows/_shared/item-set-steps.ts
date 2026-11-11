import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkItemSetKeys } from "@zoonk/core/library/items/check-set-keys";
import {
  type ItemSetToStore,
  type WrittenSetItem,
  createItemSet,
} from "@zoonk/core/library/items/create-set";

async function checkItemSetKeysStep({
  wait,
  ...input
}: {
  analytics: AiGenerationContext;
  set: ItemSetToStore<WrittenSetItem>;
  wait: CallWait;
}): Promise<ItemSetToStore> {
  "use step";

  return checkItemSetKeys({ ...input, serviceTier: chooseServiceTier({ wait }) });
}

async function storeItemSetStep(set: ItemSetToStore): Promise<string | null> {
  "use step";

  const { set: stored } = await createItemSet(set);
  return stored?.id ?? null;
}

export async function storeKeyCheckedItemSet({
  set,
  ...input
}: {
  analytics: AiGenerationContext;
  set: ItemSetToStore<WrittenSetItem> | null;
  wait: CallWait;
}): Promise<string | null> {
  if (!set) {
    return null;
  }

  return storeItemSetStep(await checkItemSetKeysStep({ ...input, set }));
}
