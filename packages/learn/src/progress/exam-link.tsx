"use client";

import { MapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useProgressScreen } from "./progress-context";
import { ProgressLinkRow } from "./progress-link-row";

/** An exam goal's own screen: what's on the exam, how it's scored and the mock exams. */
export function ExamLink() {
  const t = useExtracted();
  const { hrefs, progress } = useProgressScreen();

  if (progress.goal.kind !== "exam" || !hrefs.exam) {
    return null;
  }

  return (
    <ProgressLinkRow
      href={hrefs.exam}
      icon={MapIcon}
      subtitle={t("What's on it, how it's scored and your mock exams")}
      title={t("Your exam")}
    />
  );
}
