"use client";

import {
  type NotPlannedReason,
  type SyllabusTopic,
  type SyllabusView,
} from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";
import { createContext, use } from "react";

/** A free exam plan past its first week has no practice, so its quick review asks known topics instead. */
export const KnownTopicsReturnContext =
  createContext<SyllabusView["knownTopicsReturn"]>("practice");

function ReasonText({ reason }: { reason: NotPlannedReason | null }) {
  const t = useExtracted();

  if (!reason) {
    return null;
  }

  return (
    <span className="text-muted-foreground text-xs">
      {reason === "skipped" && t("You took this subject out of your plan")}
      {reason === "pastBasics" && t("You start past the basics")}
      {reason === "skippedBase" && t("You chose to skip this prerequisite")}
      {reason === "time" && t("Doesn't fit in the time you have")}
      {reason === "missing" && t("No lessons on it yet")}
    </span>
  );
}

export function TopicNote({ topic }: { topic: SyllabusTopic }) {
  const t = useExtracted();
  const returnsIn = use(KnownTopicsReturnContext);

  if (topic.status === "known") {
    return (
      <span className="text-muted-foreground text-xs">
        {returnsIn === "reviews"
          ? t("You know this · it comes back in your reviews")
          : t("You know this · it comes back in practice")}
      </span>
    );
  }

  return <ReasonText reason={topic.notPlannedReason} />;
}
