"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

/** The one frame of the field a learner asks in, wherever it shows: 44px, the container radius. */
export const TUTOR_COMPOSER_FRAME_CLASS = "bg-card ring-input rounded-xl ring-1 ring-inset";

export function TutorComposerSkeleton() {
  const t = useExtracted();

  return (
    <div className={cn(TUTOR_COMPOSER_FRAME_CLASS, "flex min-h-11 items-center gap-2 pr-2 pl-3")}>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-base md:text-sm">
        {t("Ask anything")}
      </span>
      <Skeleton className="size-7.5 shrink-0 rounded-md" />
    </div>
  );
}
