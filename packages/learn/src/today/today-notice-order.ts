import { type TodayView } from "@zoonk/core/view-models/today/get";

/** The notices Today can show. Only one shows at a time. */
export type TodayNoticeKind =
  | "exam"
  | "examAccess"
  | "freshStart"
  | "guardianInvite"
  | "insight"
  | "planChange"
  | "practice"
  | "sourceChange"
  | "suggestedGoal"
  | "uploadRequest";

/** Which notices the host has to show (it draws them, since they need its actions). */
export type TodayHostNoticeState = {
  practice: boolean;
  sourceChange: boolean;
  uploadRequest: boolean;
};

type TodaySession = TodayView["session"];

/** What of Today the pick reads. */
type NoticeTodayView = {
  exam: Pick<NonNullable<TodayView["exam"]>, "resultReported" | "stage"> | null;
  guardianInvite: boolean;
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

/** The exam's own days: the day before, the exam day and "How did it go?" until it's answered. */
function isExamDay(exam: NoticeTodayView["exam"]): boolean {
  if (!exam) {
    return false;
  }

  if (exam.stage === "afterExam") {
    return !exam.resultReported;
  }

  return exam.stage === "dayBefore" || exam.stage === "examDay";
}

/** Whether an insight is a plan change, and where it stands. */
function getInsightChange(insight: NoticeTodayView["insight"]) {
  return insight?.kind === "planChange" ? (insight.planChange?.status ?? null) : null;
}

/**
 * Where the plan change stands, unless the insight carries the same change: then the insight says
 * it, in the words of the answers that led to it. Falling behind that puts the date at risk waits
 * for the learner's choice like a proposal does.
 */
function getPlanChangeStatus({
  insight,
  planChange,
}: Pick<NoticeTodayView, "insight" | "planChange">) {
  if (!planChange || insight?.planChange?.id === planChange.id) {
    return null;
  }

  return planChange.behind ? "proposed" : planChange.status;
}

/** A lighter day says why only until the learner starts: then it has done its job. */
function showsFreshStart(today: NoticeTodayView): boolean {
  const started = today.session.blocks.some((block) => block.status !== "pending");
  return today.session.freshStart !== null && !today.studiedToday && !started;
}

/**
 * Today shows at most one notice, the one that matters most: the exam's own days, then a plan
 * change waiting for an OK (any proposal, one an insight explains, or falling behind that puts the
 * date at risk), a change in what the goal
 * is built on (its exam notice), the exam's final stretch, the end of a free exam plan's first
 * week, a document research needs, a guardian invite for a teen who just signed up from a guest
 * session, an automatic change already made (with its undo), a tip, a
 * language's due practice, a lighter day's welcome and, last, a course from before goals. The rest
 * wait for another day or live on their own screens.
 */
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
    ["planChange", planChange === "proposed"],
    ["insight", insightChange === "proposed"],
    ["sourceChange", host.sourceChange],
    ["exam", exam?.stage === "finalStretch"],
    ["examAccess", session.examAccess.trialEnded],
    ["uploadRequest", host.uploadRequest],
    ["guardianInvite", today.guardianInvite],
    ["planChange", planChange === "applied"],
    ["insight", insight !== null],
    ["practice", host.practice],
    ["freshStart", showsFreshStart(today)],
    ["suggestedGoal", today.suggestedGoal !== null],
  ];

  return candidates.find(([, available]) => available)?.[0] ?? null;
}
