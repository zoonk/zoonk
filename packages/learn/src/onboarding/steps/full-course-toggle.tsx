"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { type ExamFinish, useExamFullCourseText } from "../../plan/plan-full-course";

export function FullCourseToggle({
  checked,
  end,
  id,
  onCheckedChange,
}: {
  checked: boolean;
  end: ExamFinish | null;
  id: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const t = useExtracted();
  const examText = useExamFullCourseText();
  const switchId = useId();
  const descriptionId = useId();

  return (
    <div className="flex flex-col gap-1" id={id}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label className="cursor-pointer font-medium" htmlFor={switchId}>
          {t("Study everything, even after the exam")}
        </label>
        <Switch
          aria-describedby={descriptionId}
          checked={checked}
          id={switchId}
          onCheckedChange={onCheckedChange}
        />
      </div>
      <p className="text-muted-foreground text-sm text-pretty" id={descriptionId}>
        {examText(checked ? end : null)}
      </p>
    </div>
  );
}
