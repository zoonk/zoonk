"use client";

import { Button } from "@zoonk/ui/components/button";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { useSessionAction } from "./use-session-action";

const SIZE_CLASS = {
  /** A page's second action: a full 44 px button on a phone. */
  page: "max-sm:h-11 max-sm:w-full max-sm:rounded-lg max-sm:text-sm sm:self-start",
  small: "self-start",
} as const;

/**
 * More study after the day's list, on Today and on the day's summary. Core offers it only while
 * something is left to practice or learn, so a failure here is a connection problem worth retrying.
 */
export function ExtraTimeButton({
  action,
  label,
  minutes,
  size = "small",
}: {
  action: () => Promise<boolean>;
  label?: string;
  minutes: number;
  size?: keyof typeof SIZE_CLASS;
}) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action });

  return (
    <>
      <form action={() => void run()} className="contents">
        <Button
          busy={isPending}
          className={SIZE_CLASS[size]}
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
