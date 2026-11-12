"use client";

import { Button } from "@zoonk/ui/components/button";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { useSessionAction } from "../session/use-session-action";

export function TodayExtraTime({
  action,
  className,
  minutes,
  more,
}: {
  action: () => Promise<boolean>;
  className?: string;
  minutes: number;
  /** The learner already studied today, so this is on top of it. */
  more: boolean;
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
          {more
            ? t("Practice {minutes} more min", { minutes: String(minutes) })
            : t("Practice {minutes} min", { minutes: String(minutes) })}
        </Button>
      </form>

      {failed && <ChangeSaveError />}
    </>
  );
}
