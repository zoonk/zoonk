import { getExamDocument } from "../../exams/exam-document";
import { isAutomaticPlanChange } from "../../plans/_utils/automatic-plan-change";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { isDateReached } from "../../plans/_utils/plan-end";
import { type PlanChangeRecord } from "../../plans/_utils/replan";
import { type TodayPlanChangeView } from "../../plans/_utils/today-plan-change";
import { getSelectedPlanChange } from "./save-selected-plan";
import { type SelectedDayPlan } from "./selected-day-plan";

/** The exact mandatory change that the selected plan's next POST will publish. No row is invented. */
export function getSelectedPlanNotice({
  change: preparedChange,
  now,
  selection,
}: {
  change?: PlanChangeRecord | null;
  now: Date;
  selection: SelectedDayPlan | null;
}): TodayPlanChangeView | null {
  if (!selection) {
    return null;
  }

  const change = preparedChange === undefined ? getSelectedPlanChange(selection) : preparedChange;

  if (!change || change.status !== "applied") {
    return null;
  }

  const payload = parsePlanChangePayload(change.payload);

  const dateReached = isDateReached({
    studiesPastTarget:
      selection.context.goal.kind === "exam" && selection.state.settings.fullCourse,
    targetDate: selection.context.goal.targetDate,
    today: selection.context.today,
  });

  if (!isAutomaticPlanChange({ change, dateReached })) {
    return null;
  }

  return {
    behind: payload.behind,
    canUndo: false,
    chapterTitle: null,
    createdAt: now.toISOString(),
    days: payload.days,
    effect: payload.effect,
    examDocument: getExamDocument(selection.context.goal),
    id: null,
    kind: change.kind,
    lessonsSkipped: payload.lessonsSkipped ?? payload.planItemIds.length,
    officialDate: payload.officialDate,
    operations: payload.operations,
    reason: null,
    seen: false,
    source: payload.source,
    status: change.status,
    todaySession: null,
  };
}
