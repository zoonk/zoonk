"use client";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@zoonk/ui/components/message-scroller";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ArrowDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function ThreadViewport({ children, ...props }: React.ComponentProps<"div">) {
  const t = useExtracted();

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller>
        <MessageScrollerViewport className="px-4 py-6 sm:px-5" {...props}>
          {children}
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label={t("Scroll to latest")}>
          <ArrowDownIcon aria-hidden="true" />
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

export function ThreadViewportSkeleton() {
  const t = useExtracted();

  return (
    <ThreadViewport>
      <p className="sr-only" role="status">
        {t("Loading questions…")}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-16 w-3/4 rounded-2xl" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </ThreadViewport>
  );
}
