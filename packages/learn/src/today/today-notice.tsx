"use client";

import { type TodayNoticeKind } from "@zoonk/core/view-models/today/notice";
import { cn } from "@zoonk/ui/lib/utils";
import { useRef, useState } from "react";
import { useFocusOnRemovedControl } from "../_components/suggestion-focus";
import { useTodayScreen } from "./today-context";
import { TodayExamAccess } from "./today-exam-access";
import { TodayExamChoice } from "./today-exam-choice";
import { TodayExamMoment } from "./today-exam-moment";
import { TodayFocusTest } from "./today-focus-test";
import { TodayInsight } from "./today-insight";
import { TodayPlanChange } from "./today-plan-change";
import { TodaySuggestedGoal } from "./today-suggested-goal";
import { useTodayVisit } from "./use-today-visit";

/**
 * Today's notice follows its latest read until the learner touches it, so a notice due now replaces
 * an older one; from then on it stays for the visit, so answering it shows what the answer did.
 */
function useShownNotice(picked: TodayNoticeKind | null) {
  const visit = useTodayVisit();
  const [held, setHeld] = useState<{ kind: TodayNoticeKind; visit: number } | null>(null);
  const kind = held?.visit === visit ? held.kind : picked;

  const hold = () => {
    if (kind !== null && held?.visit !== visit) {
      setHeld({ kind, visit });
    }
  };

  return { hold, kind, visit };
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
    case "focusTest":
      return <TodayFocusTest />;
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
  children,
  className,
  fallbackFocus,
}: {
  children?: React.ReactNode;
  className?: string;
  fallbackFocus: React.RefObject<HTMLElement | null>;
}) {
  const { today } = useTodayScreen();
  const { hold, kind, visit } = useShownNotice(today.notice);
  const slot = useRef<HTMLDivElement>(null);

  useFocusOnRemovedControl(slot, () => fallbackFocus.current);

  return (
    <div
      className={cn("flex flex-col gap-3 empty:hidden", className)}
      data-slot="today-notice"
      onClickCapture={hold}
      ref={slot}
    >
      <NoticeOfKind key={visit} kind={kind} />
      {children}
    </div>
  );
}
