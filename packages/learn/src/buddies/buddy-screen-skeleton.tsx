"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import { TutorComposerSkeleton } from "../conversation/tutor-composer";
import { PageWithAside } from "../shell/learn-shell";
import { BuddyConversationsSkeleton } from "./buddy-conversations";
import { BUDDY_COLUMN_CLASS } from "./buddy-header";

export function BuddyScreenSkeleton() {
  const t = useExtracted();

  return (
    <PageWithAside
      aside={<BuddyConversationsSkeleton />}
      asideClassName="hidden"
      asideLabel={t("Conversations")}
      className="flex-1"
    >
      <div className={BUDDY_COLUMN_CLASS}>
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="mt-auto flex flex-col gap-3 pt-6 pb-3 lg:pb-6">
          <Skeleton className="h-6.5 w-4/5 rounded-md" />
          <TutorComposerSkeleton />
        </div>
      </div>
    </PageWithAside>
  );
}
