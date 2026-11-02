"use client";

import { showsFreshStart } from "@zoonk/core/view-models/today/notice";
import { cn } from "@zoonk/ui/lib/utils";
import { SunriseIcon } from "lucide-react";
import { useTodayScreen } from "./today-context";
import { useFreshStartText, useSessionState } from "./use-today-copy";

/**
 * It belongs to the session it explains, so no notice ever hides it, and it goes once the learner
 * starts.
 */
export function TodayFreshStart({ className }: { className?: string }) {
  const text = useFreshStartText();
  const { today } = useTodayScreen();
  const { ahead, limitReached, rest } = useSessionState();

  if (!text || !showsFreshStart(today) || ahead || limitReached || rest) {
    return null;
  }

  return (
    <p
      className={cn(
        "text-muted-foreground flex items-start gap-2 text-[0.8125rem] leading-snug text-pretty",
        className,
      )}
      data-slot="today-fresh-start"
    >
      <SunriseIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      {text}
    </p>
  );
}
