"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { useSessionAction } from "./use-session-action";

/**
 * Core offers it only while something is left to practice or learn, so a failure here is a
 * connection problem worth retrying.
 */
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
      <form action={() => void run()} className="contents">
        <Button
          busy={isPending}
          className={cn("self-start", className)}
          icon={<PlayIcon aria-hidden="true" />}
          size="sm"
          type="submit"
          variant="outline"
        >
          {label ?? t("Practice {minutes} more min", { minutes: String(minutes) })}
        </Button>
      </form>

      {failed && <ChangeSaveError />}
    </>
  );
}
