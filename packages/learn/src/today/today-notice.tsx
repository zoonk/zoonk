"use client";

import { useState } from "react";
import { type TodayHostNotices, useTodayScreen } from "./today-context";
import { TodayExamAccess } from "./today-exam-access";
import { TodayExamMoment } from "./today-exam-moment";
import { TodayFreshStart } from "./today-fresh-start";
import { TodayGuardianInvite } from "./today-guardian-invite";
import { TodayInsight } from "./today-insight";
import {
  type TodayHostNoticeState,
  type TodayNoticeKind,
  pickTodayNotice,
} from "./today-notice-order";
import { TodayPlanChange } from "./today-plan-change";
import { TodaySuggestedGoal } from "./today-suggested-goal";

function toHostState(notices: TodayHostNotices): TodayHostNoticeState {
  return {
    practice: notices.practice !== null,
    sourceChange: notices.sourceChange !== null,
    uploadRequest: notices.uploadRequest !== null,
  };
}

/**
 * The notice picked when Today opened stays while the learner is here, so answering it shows what
 * the answer did instead of swapping in the next notice, which waits for the next visit. A notice
 * that turns up later (Today reads itself again while lessons are written) shows when none did.
 */
function useShownNotice(picked: TodayNoticeKind | null): TodayNoticeKind | null {
  const [shown, setShown] = useState(picked);

  if (shown === null && picked !== null) {
    setShown(picked);
  }

  return shown ?? picked;
}

/** The one notice Today shows, the most important one. */
export function TodayNotice() {
  const { notices, today } = useTodayScreen();
  const kind = useShownNotice(pickTodayNotice({ host: toHostState(notices), today }));

  switch (kind) {
    case "exam":
      return <TodayExamMoment />;
    case "examAccess":
      return <TodayExamAccess />;
    case "freshStart":
      return <TodayFreshStart />;
    case "guardianInvite":
      return <TodayGuardianInvite />;
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
