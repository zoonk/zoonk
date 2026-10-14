"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { SunriseIcon } from "lucide-react";
import { useTodayScreen } from "./today-context";
import { showsFreshStart } from "./today-notice-order";
import { useFreshStartText, useSessionState } from "./use-today-copy";

/**
 * Why today starts fresh, as one quiet line under the title: a welcome back, a new phase or a new
 * week. It belongs to the session it explains, so no notice ever hides it (a free learner back
 * after 12 days saw only the end of the free week), and it goes once the learner starts. A day
 * with nothing to start says its own words instead (a rest day after a break says hello there).
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
