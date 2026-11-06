"use client";

import { type TodayNoticeKind } from "@zoonk/core/view-models/today/notice";
import { cn } from "@zoonk/ui/lib/utils";
import { useRef, useState } from "react";
import { useFocusOnRemovedControl } from "../_components/suggestion-focus";
import { useTodayScreen } from "./today-context";
import { TodayExamAccess } from "./today-exam-access";
import { TodayExamChoice } from "./today-exam-choice";
import { TodayExamMoment } from "./today-exam-moment";
import { TodayInsight } from "./today-insight";
import { TodayPlanChange } from "./today-plan-change";
import { TodaySuggestedGoal } from "./today-suggested-goal";

/**
 * The notice picked when Today opened stays while the learner is here, so answering it shows what
 * the answer did; the next waits for the next visit.
 */
function useShownNotice(picked: TodayNoticeKind | null): TodayNoticeKind | null {
  const [shown, setShown] = useState(picked);

  if (shown === null && picked !== null) {
    setShown(picked);
  }

  return shown ?? picked;
}

function NoticeOfKind({ kind }: { kind: TodayNoticeKind | null }) {
  const { notices } = useTodayScreen();

  switch (kind) {
    case "exam":
      return <TodayExamMoment />;
    case "examAccess":
      return <TodayExamAccess />;
    case "examChoice":
      return <TodayExamChoice />;
    case "insight":
      return <TodayInsight />;
    case "planChange":
      return <TodayPlanChange />;
    case "practice":
      return notices.practice;
    case "sourceChange":
      return notices.sourceChange;
    case "suggestedGoal":
      return <TodaySuggestedGoal />;
    case "uploadRequest":
      return notices.uploadRequest;
    case null:
      return null;
    default:
      return null;
  }
}

/**
 * A notice that goes away while it holds focus, such as one the learner dismissed, hands focus to
 * `fallbackFocus`.
 */
export function TodayNotice({
  className,
  fallbackFocus,
}: {
  className?: string;
  fallbackFocus: React.RefObject<HTMLElement | null>;
}) {
  const { today } = useTodayScreen();
  const kind = useShownNotice(today.notice);
  const slot = useRef<HTMLDivElement>(null);

  useFocusOnRemovedControl(slot, () => fallbackFocus.current);

  return (
    <div
      className={cn("flex flex-col empty:hidden", className)}
      data-slot="today-notice"
      ref={slot}
    >
      <NoticeOfKind kind={kind} />
    </div>
  );
}
