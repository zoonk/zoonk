"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/** The buddy's composer panel on its page, which what stands in its place shares. */
export const TUTOR_COMPOSER_FRAME_CLASS = "bg-card ring-input rounded-[0.875rem] ring-1 ring-inset";

/**
 * The buddy's composer while its conversation loads: its panel with the words it asks for, where
 * it sits, so the page reads as the buddy's from its first frame. The words are the composer's own
 * (`useTutorConversationContent`), from the same catalog.
 */
export function TutorComposerSkeleton() {
  const t = useExtracted();

  return (
    <div
      className={cn(TUTOR_COMPOSER_FRAME_CLASS, "flex min-h-12 items-center gap-2 pr-2.25 pl-3.5")}
    >
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-[0.9375rem]">
        {t("Ask a question or request a change")}
      </span>
      <Skeleton className="size-7.5 shrink-0 rounded-lg" />
    </div>
  );
}
