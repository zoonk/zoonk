import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { checkItemKeys } from "./check-item-keys";
import { type ItemSetToStore, type WrittenSetItem } from "./create-item-set";
import { type ParsedItemSetContent, parseItemSetContent } from "./item-set-content";

export function toItemSetStimulus({ content, kind }: ParsedItemSetContent): string {
  if (kind === "audio") {
    const labels = new Map(content.script.speakers.map((speaker) => [speaker.key, speaker.label]));

    const turns = content.script.turns.map(
      (turn) => `${labels.get(turn.speaker) ?? turn.speaker}: ${turn.text}`,
    );

    return [content.title, ...turns].filter(Boolean).join("\n");
  }

  const chart = kind === "chart" ? JSON.stringify(content.visual) : null;
  return [content.title, content.text, chart].filter(Boolean).join("\n\n");
}

/**
 * Solves the set's multiple-choice and true/false questions blind, with its stimulus, and returns
 * the set with only the questions to store: those whose key the solve reproduced, and those of
 * other formats as written. Makes no model call when nothing is left to check.
 */
export async function checkItemSetKeys({
  analytics,
  serviceTier,
  set,
}: {
  analytics?: AiGenerationContext;
  serviceTier?: ServiceTier;
  set: ItemSetToStore<WrittenSetItem>;
}): Promise<ItemSetToStore> {
  const { content, items, kind, language, optionCount, optionLanguage } = set;

  const { kept } = await checkItemKeys({
    analytics,
    items: items.map(({ item }) => item),
    language,
    optionCount,
    optionLanguage,
    serviceTier,
    stimulus: toItemSetStimulus(parseItemSetContent({ content, kind })),
  });

  return {
    ...set,
    items: kept.flatMap(({ index, item }) => {
      const written = items[index];
      return written ? [{ format: written.format, item, skillId: written.skillId }] : [];
    }),
  };
}
