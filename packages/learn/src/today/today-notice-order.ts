import { type TodayView } from "@zoonk/core/view-models/today/get";

export type TodayNoticeKind =
  | "exam"
  | "examAccess"
  | "examChoice"
  | "insight"
  | "planChange"
  | "practice"
  | "sourceChange"
  | "suggestedGoal"
  | "uploadRequest";

export type TodayHostNoticeState = {
  practice: boolean;
  sourceChange: boolean;
  uploadRequest: boolean;
};

type TodaySession = TodayView["session"];

type NoticeTodayView = {
  exam: Pick<NonNullable<TodayView["exam"]>, "resultReported" | "stage"> | null;
  examChoice: Pick<NonNullable<TodayView["examChoice"]>, "group"> | null;
  insight: Pick<NonNullable<TodayView["insight"]>, "kind" | "planChange"> | null;
  planChange: Pick<NonNullable<TodayView["planChange"]>, "behind" | "id" | "status"> | null;
  session: {
    blocks: Pick<TodaySession["blocks"][number], "status">[];
    examAccess: Pick<TodaySession["examAccess"], "trialEnded">;
    freshStart: TodaySession["freshStart"];
  };
  studiedToday: boolean;
  suggestedGoal: TodayView["suggestedGoal"];
};

function isExamDay(exam: NoticeTodayView["exam"]): boolean {
  if (!exam) {
    return false;
  }

  if (exam.stage === "afterExam") {
    return !exam.resultReported;
  }

  return exam.stage === "dayBefore" || exam.stage === "examDay";
}

function getInsightChange(insight: NoticeTodayView["insight"]) {
  return insight?.kind === "planChange" ? (insight.planChange?.status ?? null) : null;
}

function getPlanChangeStatus({
  insight,
  planChange,
}: Pick<NoticeTodayView, "insight" | "planChange">) {
  if (!planChange || insight?.planChange?.id === planChange.id) {
    return null;
  }

  return planChange.behind ? "proposed" : planChange.status;
}

export function showsFreshStart(today: Pick<NoticeTodayView, "session" | "studiedToday">): boolean {
  const started = today.session.blocks.some((block) => block.status !== "pending");
  return today.session.freshStart !== null && !today.studiedToday && !started;
}

/** One notice at most, the most pressing first. A free exam plan's ended week goes before anything that asks more of the plan, and a fresh start is the session's own words, never a notice. */
export function pickTodayNotice({
  host,
  today,
}: {
  host: TodayHostNoticeState;
  today: NoticeTodayView;
}): TodayNoticeKind | null {
  const { exam, insight, session } = today;
  const insightChange = getInsightChange(insight);
  const planChange = getPlanChangeStatus(today);

  const candidates: [TodayNoticeKind, boolean][] = [
    ["exam", isExamDay(exam)],
    ["examAccess", session.examAccess.trialEnded],
    ["planChange", planChange === "proposed"],
    ["insight", insightChange === "proposed"],
    ["sourceChange", host.sourceChange],
    ["exam", exam?.stage === "finalStretch"],
    ["uploadRequest", host.uploadRequest],
    ["examChoice", today.examChoice !== null],
    ["planChange", planChange === "applied"],
    ["insight", insight !== null],
    ["practice", host.practice],
    ["suggestedGoal", today.suggestedGoal !== null && !showsFreshStart(today)],
  ];

  return candidates.find(([, available]) => available)?.[0] ?? null;
}
