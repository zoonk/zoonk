"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";

export function WeekendTime({
  checked,
  children,
  className,
  onCheckedChange,
  readOnly,
}: {
  checked: boolean;
  children: React.ReactNode;
  className?: string;
  onCheckedChange: (checked: boolean) => void;
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
