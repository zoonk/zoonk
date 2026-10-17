"use client";

import {
  type NotPlannedReason,
  type SyllabusTopic,
  type SyllabusView,
} from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";
import { createContext, use } from "react";

/**
 * Where a known topic comes back to be confirmed (see `SyllabusView.knownTopicsReturn`): a free
 * exam plan past its first week has no practice, so its quick review asks them.
 */
export const KnownTopicsReturnContext =
  createContext<SyllabusView["knownTopicsReturn"]>("practice");

/** Why a topic isn't in the plan, in a few words under its name. */
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

/**
 * A few words under a topic: why it isn't in the plan, or for one the learner showed they know,
 * that practice (or the quick review, see `KnownTopicsReturnContext`) still asks it: a miss there
 * brings its lessons back.
 */
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
