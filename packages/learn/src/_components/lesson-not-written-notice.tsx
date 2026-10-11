"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ComponentProps } from "react";
import { useFreeWeekOverCopy } from "./free-week-over";
import { type LessonLimit, LessonLimitNotice } from "./help-limit-notice";

/**
 * Why a lesson won't be written now: the learner's allowance said not now (`refused`, with why),
 * every draft failed its checks, so nothing writes it again (`setAside`), or a free exam plan past
 * its first week holds this new lesson for Plus (`plusRequired`).
 */
export type LessonNotWritten =
  | { limit: LessonLimit; status: "refused" }
  | { status: "plusRequired" }
  | { status: "setAside" };

type NoticeLinks = Pick<ComponentProps<typeof LessonLimitNotice>, "linkComponent" | "routes">;

/** A free exam plan's new lesson past its first week: what stays free, and Plus as the way on. */
function FreeWeekOver({ linkComponent: LinkComponent, routes }: NoticeLinks) {
  const t = useExtracted();
  const { body, title } = useFreeWeekOverCopy();

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="flex flex-col gap-1 text-sm text-pretty">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{body}</span>
      </p>
      <LinkComponent
        className={buttonVariants({ size: "sm", variant: "outline" })}
        href={routes.upgrade}
      >
        {t("See Plus")}
      </LinkComponent>
    </div>
  );
}

/**
 * Takes the wait's place when a lesson won't be written now, so the learner never waits for
 * nothing: the shared limit notice with its one thing to do (an account, Plus, or a short break
 * with "Try again"), the end of a free exam plan's first week, or why a lesson was set aside.
 * Hosts pass their links, like the notice.
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
      {reason.status === "refused" && (
        <>
          <LessonLimitNotice limit={reason.limit} {...links} />

          {reason.limit.status === "slowDown" && onRetry && (
            <Button onClick={onRetry} size="sm" variant="outline">
              {t("Try again")}
            </Button>
          )}
        </>
      )}

      {reason.status === "plusRequired" && <FreeWeekOver {...links} />}

      {reason.status === "setAside" && (
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
