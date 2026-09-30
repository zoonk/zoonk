"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { FileClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * A source the goal is built on changed, such as a corrected exam notice or an amended law: one
 * line on Today in both modes, "The exam notice changed: the test now has 60 questions." It's news,
 * not a question, so there's nothing to answer; it leaves Today after two weeks.
 */
export function TodayChangeNotice({ className, message }: { className?: string; message: string }) {
  const t = useExtracted();

  return (
    <aside
      aria-label={t("What changed")}
      className={cn(
        "border-border in-data-[mode=fun]:fun-glass flex items-start gap-3 rounded-2xl border p-3 text-sm",
        className,
      )}
      data-slot="change-notice"
    >
      <LineMarker>
        <FileClockIcon aria-hidden="true" className="text-muted-foreground size-5" />
      </LineMarker>
      <p className="min-w-0 flex-1">{message}</p>
    </aside>
  );
}
