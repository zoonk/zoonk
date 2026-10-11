"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { SunriseIcon } from "lucide-react";
import { kindTextClass } from "../_components/kind-tile";
import { useTodayScreen } from "./today-context";
import { showsFreshStart } from "./today-notice-order";
import { useFreshStartText, useSessionState } from "./use-today-copy";

/**
 * Why today starts fresh, as the session card's first line: a welcome back, a new phase or a new
 * week. It belongs to the session it explains, so no notice ever hides it (a free learner back
 * after 12 days saw only the end of the free week), and it goes once the learner starts. A day
 * with nothing to start says its own words instead (a rest day after a break says hello there).
 */
export function TodayFreshStart() {
  const text = useFreshStartText();
  const { today } = useTodayScreen();
  const { ahead, limitReached, rest } = useSessionState();

  if (!text || !showsFreshStart(today) || ahead || limitReached || rest) {
    return null;
  }

  return (
    <p
      className="flex items-start gap-2.5 border-b pb-4 text-[0.9375rem] leading-snug font-medium text-balance"
      data-slot="today-fresh-start"
    >
      <LineMarker>
        <SunriseIcon aria-hidden="true" className={cn("size-4", kindTextClass("review"))} />
      </LineMarker>
      {text}
    </p>
  );
}
