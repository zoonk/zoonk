"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ComponentProps } from "react";
import { useHeldSlot } from "../_utils/use-held-slot";
import {
  type LessonLimit,
  LessonLimitNotice,
  useFreeLessonReady,
  useLiveLimit,
} from "./help-limit-notice";

export type LessonNotWritten = { limit: LessonLimit; status: "refused" } | { status: "setAside" };

type NoticeLinks = Pick<ComponentProps<typeof LessonLimitNotice>, "linkComponent" | "routes">;

function RefusedNotice({
  limit,
  onRetry,
  ...links
}: NoticeLinks & { limit: LessonLimit; onRetry?: () => void }) {
  const t = useExtracted();
  const ready = useFreeLessonReady(limit);
  const retries = onRetry && (limit.status === "slowDown" || ready);

  return (
    <LessonLimitNotice
      action={
        retries && (
          <form action={() => onRetry()} className="contents">
            <Button size="sm" type="submit" variant="outline">
              {ready ? t("Start the lesson") : t("Try again")}
            </Button>
          </form>
        )
      }
      limit={limit}
      {...links}
    />
  );
}

export function LessonNotWrittenNotice({
  className,
  onRetry,
  reason,
  ...links
}: NoticeLinks & { className?: string; onRetry?: () => void; reason: LessonNotWritten }) {
  const t = useExtracted();
  const refused = reason.status === "refused" ? reason.limit : null;
  const slot = useHeldSlot<HTMLDivElement>(useLiveLimit(refused) !== null);

  return (
    <div
      className={cn("bg-muted/60 flex flex-col items-start gap-3 rounded-xl p-4", className)}
      ref={slot}
      role="status"
    >
      {reason.status === "refused" && (
        <RefusedNotice limit={reason.limit} onRetry={onRetry} {...links} />
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
