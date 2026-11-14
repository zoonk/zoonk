"use client";

import { type ExamMomentView } from "@zoonk/core/exams/view/contract";
import { CalendarHeartIcon, FlagIcon, MessageCircleQuestionIcon, MoonIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PAGE_SECTION_TITLE_CLASS } from "../_components/page";
import { ExamChecklist } from "./exam-checklist";
import { useExamDayText } from "./exam-labels";

type Moment = Pick<
  ExamMomentView,
  | "checklist"
  | "day"
  | "examName"
  | "mocksTaken"
  | "prepared"
  | "resultReported"
  | "sessionsDone"
  | "stage"
  | "tools"
>;

export const EXAM_MOMENT_ICONS = {
  afterExam: MessageCircleQuestionIcon,
  dayBefore: MoonIcon,
  examDay: CalendarHeartIcon,
  finalStretch: FlagIcon,
} as const;

function useWorkLine(moment: Moment): string {
  const t = useExtracted();

  return moment.mocksTaken > 0
    ? t(
        "{days, plural, =0 {# days} one {# day} other {# days}} of study and {mocks, plural, one {# mock exam} other {# mock exams}} done.",
        { days: moment.sessionsDone, mocks: moment.mocksTaken },
      )
    : t("{days, plural, =0 {# days} one {# day} other {# days}} of study done.", {
        days: moment.sessionsDone,
      });
}

type MomentCopy = { body: string; lead: string | null; title: string };

export function useExamMomentCopy(moment: Moment): MomentCopy | null {
  const t = useExtracted();
  const work = useWorkLine(moment);
  const lead = moment.prepared ? t("You've prepared for this.") : null;

  switch (moment.stage) {
    case "finalStretch":
      return {
        body: t("From now on, review and mock exams."),
        lead: null,
        title: t("The final stretch"),
      };
    case "dayBefore":
      return { body: work, lead, title: t("{exam} is tomorrow", { exam: moment.examName }) };
    case "examDay":
      return { body: work, lead, title: t("{exam} is today", { exam: moment.examName }) };
    case "afterExam":
      return moment.resultReported
        ? null
        : {
            body: t("Add your official result when it comes out."),
            lead: null,
            title: t("How did it go?"),
          };
    default:
      return null;
  }
}

export function ExamMomentDay({ moment }: { moment: Moment }) {
  const dayText = useExamDayText();
  const day = moment.stage === "afterExam" ? null : moment.day;

  return day && <p className="text-compact font-mono font-medium tabular-nums">{dayText(day)}</p>;
}

/** What the learner has done, for the paragraph under the moment's title. */
export function ExamMomentBody({ copy }: { copy: MomentCopy }) {
  return (
    <>
      {copy.lead && <span className="text-foreground">{copy.lead} </span>}
      {copy.body}
    </>
  );
}

export function ExamMomentCard({ moment }: { moment: Moment }) {
  const copy = useExamMomentCopy(moment);

  if (!copy) {
    return null;
  }

  const Icon = EXAM_MOMENT_ICONS[moment.stage];

  return (
    <section aria-label={copy.title} className="flex flex-col gap-6" data-slot="exam-moment">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-5 shrink-0 items-center">
          <Icon className="text-muted-foreground size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className={PAGE_SECTION_TITLE_CLASS}>{copy.title}</h2>
          <ExamMomentDay moment={moment} />
          <p className="text-muted-foreground text-compact leading-snug">
            <ExamMomentBody copy={copy} />
          </p>
        </div>
      </div>

      <ExamChecklist items={moment.checklist} tools={moment.tools} />
    </section>
  );
}
