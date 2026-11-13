import { isDeepStrictEqual } from "node:util";
import { type Item, type ItemSet } from "@zoonk/db";
import { z } from "zod";
import { parseItemSetContent } from "../../../library/items/item-set-content";
import { type Json, type Refusal, refuse, toJson } from "../_utils/resolved-change";
import { checkItemContent } from "./item-content-rules";

export function checkReplacement(
  set: ItemSet & { items: Item[] },
  sent: { content: Json; questions: { id: string; content: Json }[] },
): { content: Json; questions: { id: string; content: Json }[] } | Refusal {
  let content: Json;

  try {
    content = toJson(parseItemSetContent({ content: sent.content, kind: set.kind }).content);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return refuse(error.message);
    }

    throw error;
  }

  if (set.kind === "audio" && !isDeepStrictEqual(set.content, content)) {
    return refuse("An audio set keeps its recording and transcript; a fix cannot revoice it.");
  }

  const questionsSent = sent.questions;

  if (
    questionsSent.length !== set.items.length ||
    set.items.some((item, index) => questionsSent[index]?.id !== item.id)
  ) {
    return refuse("Send every question once, in its existing order.");
  }

  const questions: { id: string; content: Json }[] = [];

  for (const item of set.items) {
    const next = questionsSent.find((question) => question.id === item.id);

    if (!next) {
      return refuse("Missing question.");
    }

    const checked = checkItemContent({
      allowUnchanged: true,
      inPlace: false,
      item,
      sent: next.content,
    });

    if ("ok" in checked) {
      return checked;
    }

    questions.push({ content: checked.after, id: item.id });
  }

  return { content, questions };
}
