"use client";

import { type TodayNoticeKind } from "@zoonk/core/view-models/today/notice";
import { cn } from "@zoonk/ui/lib/utils";
import { useState } from "react";
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

export function TodayNotice({ className }: { className?: string }) {
  const { today } = useTodayScreen();
  const kind = useShownNotice(today.notice);

  return (
    <div className={cn("flex flex-col empty:hidden", className)} data-slot="today-notice">
      <NoticeOfKind kind={kind} />
    </div>
  );
}
