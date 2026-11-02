import { type Item } from "@zoonk/db";
import { parseItemContent } from "../../../library/items/item-content";

export type EssayContent = Extract<
  ReturnType<typeof parseItemContent>,
  { format: "essay" }
>["content"];

export function readEssayContent(item: Item | null): EssayContent | null {
  if (item?.format !== "essay") {
    return null;
  }

  const parsed = parseItemContent({ content: item.content, format: "essay" });
  return parsed.format === "essay" ? parsed.content : null;
}
