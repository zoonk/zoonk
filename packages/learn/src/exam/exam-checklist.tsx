"use client";

import { type ExamDayChecklistKey } from "@zoonk/core/exams/final-stretch/rules";
import { useExtracted } from "next-intl";
import { Checklist } from "../_components/checklist";
import { useExamChecklistLabel } from "./exam-labels";

/** What to have ready for the real exam day: documents, pen, route, time and sleep, or a class test's short list. */
export function ExamChecklist({ items }: { items: readonly ExamDayChecklistKey[] }) {
  const t = useExtracted();
  const label = useExamChecklistLabel();

  return <Checklist items={items} label={label} title={t("For exam day")} />;
}
