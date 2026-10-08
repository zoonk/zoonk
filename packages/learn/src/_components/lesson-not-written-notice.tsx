"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ComponentProps } from "react";
import { type LessonLimit, LessonLimitNotice } from "./help-limit-notice";

/**
 * Why a lesson won't be written now: the learner's allowance said not now (`refused`, with why),
 * or every draft failed its checks, so nothing writes it again (`setAside`).
 */
export type LessonNotWritten = { limit: LessonLimit; status: "refused" } | { status: "setAside" };

type NoticeLinks = Pick<ComponentProps<typeof LessonLimitNotice>, "linkComponent" | "routes">;

/**
 * Takes the wait's place when a lesson won't be written now, so the learner never waits for
 * nothing: the shared limit notice with its one thing to do (an account, Plus, or a short break
 * with "Try again"), or why a lesson was set aside. Hosts pass their links, like the notice.
 */
export function LessonNotWrittenNotice({
  className,
  onRetry,
  reason,
  ...links
}: NoticeLinks & {
  className?: string;
  /** Asks again after a short break; only fair use offers it. */
  onRetry?: () => void;
  reason: LessonNotWritten;
}) {
  const t = useExtracted();

  return (
    <div
      className={cn("bg-muted/60 flex flex-col items-start gap-3 rounded-2xl p-4", className)}
      role="status"
    >
      {reason.status === "refused" ? (
        <>
          <LessonLimitNotice limit={reason.limit} {...links} />

          {reason.limit.status === "slowDown" && onRetry && (
            <Button onClick={onRetry} size="sm" variant="outline">
              {t("Try again")}
            </Button>
          )}
        </>
      ) : (
        <p className="flex flex-col gap-1 text-sm text-pretty">
          <span className="font-medium">{t("This lesson isn't available")}</span>
          <span className="text-muted-foreground">
            {t("It didn't pass our quality checks, so your plan goes on without it.")}
          </span>
        </p>
      )}
    </div>
  );
}
