"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { useSessionAction } from "../session/use-session-action";

export function TodayExtraTime({
  action,
  className,
  label,
  minutes,
  size = "sm",
  variant = "outline",
}: {
  action: () => Promise<boolean>;
  className?: string;
  label?: string;
  minutes: number;
  size?: "lg" | "sm";
  variant?: "default" | "outline";
}) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action });

  return (
    <>
      <Button
        className={className}
        disabled={isPending}
        focusableWhenDisabled
        onClick={run}
        size={size}
        variant={variant}
      >
        {label ?? t("Study {minutes} more minutes", { minutes: String(minutes) })}
      </Button>

      {failed && <ChangeSaveError />}
    </>
  );
}
