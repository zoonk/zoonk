"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ComponentProps } from "react";
import { useFreeWeekOverCopy } from "./free-week-over";
import { type LessonLimit, LessonLimitNotice } from "./help-limit-notice";

export type LessonNotWritten =
  | { limit: LessonLimit; status: "refused" }
  | { status: "plusRequired" }
  | { status: "setAside" };

type NoticeLinks = Pick<ComponentProps<typeof LessonLimitNotice>, "linkComponent" | "routes">;

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
