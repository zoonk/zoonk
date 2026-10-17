import { type ItemFormat } from "@zoonk/db";

export const ITEM_FORMAT_LABELS: Record<ItemFormat, string> = {
  essay: "Essay",
  matchPairs: "Match pairs",
  multipleChoice: "Multiple choice",
  numeric: "Numeric",
  order: "Order",
  spoken: "Spoken",
  trueFalse: "True or false",
  typed: "Typed",
};

/** Formats keep the question under `question`, except true-or-false items, which state a claim. */
const ITEM_PROMPT_KEYS = ["question", "statement"] as const;

function readStringField(content: object, key: string): string | null {
  const value: unknown = Object.entries(content).find(([entryKey]) => entryKey === key)?.[1];
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Items have no title, so admin tables label them with their question. Content
 * is versioned JSON, so an unexpected shape falls back to the format name.
 */
export function getItemLabel({
  content,
  format,
}: {
  content: unknown;
  format: ItemFormat;
}): string {
  if (typeof content !== "object" || content === null) {
    return ITEM_FORMAT_LABELS[format];
  }

  const prompt = ITEM_PROMPT_KEYS.map((key) => readStringField(content, key)).find(Boolean);

  return prompt ?? ITEM_FORMAT_LABELS[format];
}
