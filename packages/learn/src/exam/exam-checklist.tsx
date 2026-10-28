"use client";

import { type ExamDayChecklistKey } from "@zoonk/core/exams/final-stretch/rules";
import { useExtracted } from "next-intl";
import { Checklist } from "../_components/checklist";
import { useExamChecklistLabel } from "./exam-labels";

export function ExamChecklist({
  items,
  tools,
}: {
  items: readonly ExamDayChecklistKey[];
  tools: readonly string[];
}) {
  const t = useExtracted();
  const label = useExamChecklistLabel();

  return (
    <>
      <Checklist items={items} label={label} title={t("For exam day")} />
      {items.length > 0 && tools.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{t("What you may use")}</p>
          {tools.map((line) => (
            <p className="text-muted-foreground" key={line}>
              {line}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
