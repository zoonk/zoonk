"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ComponentProps } from "react";
import { type LessonLimit, LessonLimitNotice } from "./help-limit-notice";

export type LessonNotWritten =
  | { limit: LessonLimit; status: "refused" }
  | { status: "plusRequired" }
  | { status: "setAside" };

type NoticeLinks = Pick<ComponentProps<typeof LessonLimitNotice>, "linkComponent" | "routes">;

export function LessonNotWrittenNotice({
  className,
  onRetry,
  reason,
  ...links
}: NoticeLinks & { className?: string; onRetry?: () => void; reason: LessonNotWritten }) {
  const t = useExtracted();

  return (
    <div
      className={cn("bg-muted/60 flex flex-col items-start gap-3 rounded-xl p-4", className)}
      role="status"
    >
      {reason.status === "refused" && (
        <>
          <LessonLimitNotice limit={reason.limit} {...links} />

          {reason.limit.status === "slowDown" && onRetry && (
            <form action={() => onRetry()} className="contents">
              <Button size="sm" type="submit" variant="outline">
                {t("Try again")}
              </Button>
            </form>
          )}
        </>
      )}

      {reason.status === "plusRequired" && (
        <LessonLimitNotice
          limit={{ period: "month", status: "limitReached", tier: "free" }}
          {...links}
        />
      )}

      {reason.status === "setAside" && (
        <p className="flex flex-col gap-1 text-sm text-pretty">
          <span className="font-medium">{t("This lesson isn't available")}</span>
          <span className="text-muted-foreground">{t("Your plan goes on without it.")}</span>
        </p>
      )}
    </div>
  );
}
