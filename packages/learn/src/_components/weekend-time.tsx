"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";

/**
 * "Different time on weekends": weekends often have more time (or less), so one switch gives
 * Saturday and Sunday their own amount, picked with the control the screen picks daily time with
 * (`children`), which shows only while it's on. Onboarding and the plan editor ask it the same way.
 */
export function WeekendTime({
  checked,
  children,
  className,
  onCheckedChange,
  readOnly,
}: {
  checked: boolean;
  children: React.ReactNode;
  /** The label's type, matching the screen's other questions. */
  className?: string;
  onCheckedChange: (checked: boolean) => void;
  /** Keeps its focus but can't be switched, while a change it depends on is saving. */
  readOnly?: boolean;
}) {
  const t = useExtracted();
  const switchId = useId();

  return (
    <div className="flex flex-col gap-3" data-slot="weekend-time">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label className={cn("cursor-pointer", className)} htmlFor={switchId}>
          {t("Different time on weekends")}
        </label>
        <Switch
          checked={checked}
          id={switchId}
          onCheckedChange={onCheckedChange}
          readOnly={readOnly}
        />
      </div>

      {checked && children}
    </div>
  );
}
