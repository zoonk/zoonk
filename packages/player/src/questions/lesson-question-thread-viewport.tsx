"use client";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "@zoonk/ui/components/message-scroller";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";

/** Reopening an explanation should show that answer, not the thread's latest turn. */
function QuestionScrollTarget({ questionId }: { questionId: string | null | undefined }) {
  const { scrollToMessage } = useMessageScroller();

  useEffect(() => {
    if (questionId) {
      scrollToMessage(questionId, { align: "start", behavior: "instant" });
    }
  }, [questionId, scrollToMessage]);

  return null;
}

export function ThreadViewport({
  children,
  className,
  revealedQuestionId,
  ...props
}: React.ComponentProps<"div"> & { revealedQuestionId?: string | null }) {
  const t = useExtracted();

  return (
    <MessageScrollerProvider autoScroll>
      <QuestionScrollTarget questionId={revealedQuestionId} />
      <MessageScroller>
        {/* The scroller preserves message positions; native anchoring would apply a second scroll adjustment. */}
        <MessageScrollerViewport
          className={cn("px-4 py-6 [overflow-anchor:none] sm:px-5", className)}
          {...props}
        >
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
