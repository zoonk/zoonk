"use client";

import { useRouter } from "@/i18n/navigation";
import { toDayBlockRef } from "@zoonk/core/sessions/day-block";
import {
  type DayStepOpenerProps,
  DayStepOpenerProvider,
} from "@zoonk/learn/session/day-step-opener";
import { type DayStep } from "@zoonk/learn/session/types";
import { createContext, use } from "react";
import { getStudyLessonHref } from "./lesson-opening";
import { useDayTaps } from "./use-day-taps";

const ShownLearnerContext = createContext<string | null>(null);

/** A written lesson opens at its address, as Today's row links there; any other step as Today's tap. */
function OpenDayStep({ children, day, goalId }: DayStepOpenerProps) {
  const router = useRouter();
  const userId = use(ShownLearnerContext) ?? "";
  const refresh = () => router.refresh();

  const taps = useDayTaps({
    day: { sessionId: day.status === "unstarted" ? null : day.id, shown: { day, goalId, userId } },
    refresh,
  });

  const open = (step: DayStep): Promise<boolean> => {
    const href = getStudyLessonHref({ block: step, goalId, session: day });

    if (href) {
      router.push(href);
      return Promise.resolve(true);
    }

    return taps.open({
      blockId: "id" in step ? step.id : null,
      position: step.position,
      ref: toDayBlockRef(step),
      screen: step.screen,
    });
  };

  return children(open);
}

/** `userId`: the learner the page was drawn for, so a tap made for someone who left does nothing. */
export function WebDayStepOpenerProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  return (
    <ShownLearnerContext value={userId}>
      <DayStepOpenerProvider opener={OpenDayStep}>{children}</DayStepOpenerProvider>
    </ShownLearnerContext>
  );
}
