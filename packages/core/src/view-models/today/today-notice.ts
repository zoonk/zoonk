import { type TodayView } from "./get-today-view";

export const TODAY_NOTICE_KINDS = [
  "exam",
  "examChoice",
  "focusTest",
  "insight",
  "planChange",
  "practice",
  "sourceChange",
  "suggestedGoal",
  "uploadRequest",
] as const;

export type TodayNoticeKind = (typeof TODAY_NOTICE_KINDS)[number];

export type TodayHostNoticeState = {
  practice: boolean;
  sourceChange: boolean;
  uploadRequest: boolean;
};

type TodaySession = TodayView["session"];

type NoticeTodayView = {
  exam: Pick<NonNullable<TodayView["exam"]>, "resultReported" | "stage"> | null;
  examChoice: Pick<NonNullable<TodayView["examChoice"]>, "group"> | null;
  focusTest: TodayView["focusTest"];
  insight: Pick<NonNullable<TodayView["insight"]>, "kind" | "planChange"> | null;
  planChange: Pick<
    NonNullable<TodayView["planChange"]>,
    "behind" | "canUndo" | "id" | "kind" | "status"
  > | null;
  session: {
    blocks: Pick<TodaySession["blocks"][number], "status">[];
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

function showsPlanChange({ insight, planChange }: Pick<NoticeTodayView, "insight" | "planChange">) {
  if (!planChange || insight?.planChange?.id === planChange.id) {
    return false;
  }

  return (
    planChange.behind !== null ||
    planChange.kind === "noticeChanged" ||
    planChange.status === "proposed"
  );
}

/** A return after days away, until the learner starts: the day's own welcome leads it. */
export function showsWelcomeBack(
  today: Pick<NoticeTodayView, "session" | "studiedToday">,
): boolean {
  const started = today.session.blocks.some((block) => block.status !== "pending");
  return today.session.freshStart === "welcomeBack" && !today.studiedToday && !started;
}

/**
 * One notice at most, the most pressing first. While the day welcomes the learner back, only the
 * exam's own days and a test-out they can undo show.
 */
export function pickTodayNotice({
  host,
  today,
}: {
  host: TodayHostNoticeState;
  today: NoticeTodayView;
}): TodayNoticeKind | null {
  const { exam, insight } = today;
  const insightChange = getInsightChange(insight);
  const planChange = showsPlanChange(today);

  const testOut =
    today.planChange?.kind === "testedOut" &&
    today.planChange.status === "applied" &&
    today.planChange.canUndo &&
    insight?.planChange?.id !== today.planChange.id;

  const pressing: [TodayNoticeKind, boolean][] = [
    ["exam", isExamDay(exam)],
    ["planChange", testOut],
  ];

  const candidates: [TodayNoticeKind, boolean][] = showsWelcomeBack(today)
    ? pressing
    : [
        ...pressing,
        ["planChange", planChange],
        ["insight", insightChange === "proposed"],
        ["sourceChange", host.sourceChange],
        ["exam", exam?.stage === "finalStretch"],
        ["uploadRequest", host.uploadRequest],
        ["examChoice", today.examChoice !== null],
        ["insight", insight !== null],
        ["practice", host.practice],
        ["focusTest", today.focusTest !== null],
        ["suggestedGoal", today.suggestedGoal !== null],
      ];

  return candidates.find(([, available]) => available)?.[0] ?? null;
}
