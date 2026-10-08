"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { FileClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import { NoticeCardContent, NoticeCardLeading, NoticeCardTitle } from "../_components/notice-card";
import { SURFACE_CLASS } from "../_components/surface";

/**
 * A source the goal is built on changed, such as a corrected exam notice or an amended law: one
 * line on Today, "The exam notice changed: the test now has 60 questions." It's news,
 * not a question, so there's nothing to answer; it leaves Today after two weeks.
 */
export function TodayChangeNotice({ className, message }: { className?: string; message: string }) {
  const t = useExtracted();

  return (
    <aside
      aria-label={t("What changed")}
      className={cn(SURFACE_CLASS, "flex items-start gap-3 p-4", className)}
      data-slot="change-notice"
    >
      <NoticeCardLeading>
        <KindTile icon={FileClockIcon} kind="lesson" size="sm" />
      </NoticeCardLeading>
      <NoticeCardContent className="min-h-8 justify-center">
        <NoticeCardTitle className="font-medium">{message}</NoticeCardTitle>
      </NoticeCardContent>
    </aside>
  );
}
