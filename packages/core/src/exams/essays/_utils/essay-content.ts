import { type Item } from "@zoonk/db";
import { type z } from "zod";
import { parseItemContent } from "../../../library/items/item-content";
import { type writtenItemSchema } from "../writing-contract";

export type EssayContent = Extract<
  ReturnType<typeof parseItemContent>,
  { format: "essay" }
>["content"] & { writing: z.infer<typeof writtenItemSchema> };

export function readEssayContent(
  item: Pick<Item, "content" | "format"> | null,
): EssayContent | null {
  if (item?.format !== "essay") {
    return null;
  }

  const parsed = parseItemContent({ content: item.content, format: "essay" });

  return parsed.format === "essay" && parsed.content.writing
    ? { ...parsed.content, writing: parsed.content.writing }
    : null;
}
