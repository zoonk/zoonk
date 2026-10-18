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
function useFactSourceName(fact: MemoryFactView): string {
  const t = useExtracted();

  if (fact.origin === "noticed") {
    return t("Noticed from your activity");
  }

  switch (fact.source?.kind) {
    case undefined:
      return t("You told us");
    case "chat":
      return t("From a chat");
    case "onboarding":
      return t("From onboarding");
    case "session":
      return t("From a study session");
    default:
      return t("From a study session");
  }
}

/** Where a fact came from, then the day, in the mono face as every date reads ("Oct 11"). */
export function MemoryFactSource({ fact }: { fact: MemoryFactView }) {
  const format = useFormatter();
  const source = useFactSourceName(fact);

  return (
    <>
      {source}
      {" · "}
      <time
        className="font-mono text-xs tabular-nums"
        dateTime={new Date(fact.createdAt).toISOString()}
      >
        {format.dateTime(fact.createdAt, { day: "numeric", month: "short" })}
      </time>
    </>
  );
}
