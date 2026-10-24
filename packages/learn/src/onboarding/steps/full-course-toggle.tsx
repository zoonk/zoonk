"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { useExtracted } from "next-intl";
import { useId } from "react";

/**
 * "Study everything, even after the exam", where an exam's time is chosen, while the time picked
 * leaves something out: off, the plan ends at the exam with what fits; on, until the exam it's the
 * same plan, and what doesn't fit comes after it. The plan editor changes it any time.
 */
export function FullCourseToggle({
  checked,
  id,
  onCheckedChange,
}: {
  checked: boolean;
  /** Where the step finds it, to move focus to its switch once Find says no time covers it all. */
  id: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const t = useExtracted();
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
        {t("Until the exam, what comes up most comes first. What doesn't fit comes after it.")}
      </p>
    </div>
  );
}
