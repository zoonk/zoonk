"use client";

import {
  type NotPlannedReason,
  type SyllabusTopic,
} from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted } from "next-intl";

function ReasonText({ reason }: { reason: NotPlannedReason | null }) {
  const t = useExtracted();

  if (!reason) {
    return null;
  }

  return (
    <span className="text-muted-foreground text-xs">
      {reason === "skipped" && t("Not in your plan · you took this subject out")}
      {reason === "pastBasics" && t("Skipped · you already know the basics")}
      {reason === "skippedBase" && t("Skipped · your choice")}
      {reason === "time" && t("Not in your plan · your time doesn't cover it")}
      {reason === "missing" && t("Not ready yet")}
    </span>
  );
}

export function TopicNote({ topic }: { topic: SyllabusTopic }) {
  const t = useExtracted();

  if (topic.status === "known") {
    return (
      <span className="text-muted-foreground text-xs">{t("Skipped · you already know it")}</span>
    );
  }

  return <ReasonText reason={topic.notPlannedReason} />;
}
