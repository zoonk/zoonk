"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { useSessionAction } from "./use-session-action";

/** Core offers it only while something is left to practice or learn, so a failure here is a connection problem worth retrying. */
export function ExtraTimeButton({
  action,
  className,
  label,
  minutes,
}: {
  action: () => Promise<boolean>;
  className?: string;
  label?: string;
  minutes: number;
}) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action });

  return (
    <>
      <Button
        className={cn("w-full", className)}
        disabled={isPending}
        onClick={run}
        size="xl"
        variant="ghost"
      >
        {label ?? t("Study {minutes} more minutes", { minutes: String(minutes) })}
      </Button>

      {failed && <ChangeSaveError />}
    </>
  );
}
