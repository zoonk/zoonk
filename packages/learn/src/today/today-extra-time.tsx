"use client";

import { Button } from "@zoonk/ui/components/button";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { useSessionAction } from "../session/use-session-action";

export function TodayExtraTime({
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
          className={className}
          icon={<PlayIcon aria-hidden="true" />}
          size="sm"
          type="submit"
          variant="outline"
        >
          {label ?? t("Study {minutes} more minutes", { minutes: String(minutes) })}
        </Button>
      </form>

      {failed && <ChangeSaveError />}
    </>
  );
}
