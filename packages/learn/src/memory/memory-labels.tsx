"use client";

import { type MemoryFactView } from "@zoonk/core/memory/contract";
import { useExtracted, useFormatter } from "next-intl";

export type MemoryCategory = MemoryFactView["category"];

export function MemoryCategoryName({ category }: { category: MemoryCategory }) {
  const t = useExtracted();

  switch (category) {
    case "goals":
      return t("Goals");
    case "background":
      return t("Background");
    case "routine":
      return t("Routine");
    case "preferences":
      return t("Preferences");
    case "learning":
      return t("Learning");
    case "context":
      return t("Context");
    default:
      return t("Context");
  }
}

/** Where a fact came from, so the learner can tell what they said from what was noticed. */
export function MemoryFactSource({ fact }: { fact: MemoryFactView }) {
  const t = useExtracted();
  const format = useFormatter();
  const date = format.dateTime(fact.createdAt, { day: "numeric", month: "short" });

  if (fact.origin === "noticed") {
    return t("Noticed from your activity · {date}", { date });
  }

  if (!fact.source) {
    return t("You told us · {date}", { date });
  }

  switch (fact.source.kind) {
    case "chat":
      return t("From a chat · {date}", { date });
    case "onboarding":
      return t("From onboarding · {date}", { date });
    case "session":
      return t("From a study session · {date}", { date });
    default:
      return t("From a study session · {date}", { date });
  }
}
