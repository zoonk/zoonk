"use client";

import { type ExamMomentView } from "@zoonk/core/exams/view/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarHeartIcon, FlagIcon, MessageCircleQuestionIcon, MoonIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
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

const ICONS = {
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

function useMomentCopy(moment: Moment): MomentCopy | null {
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

export function ExamMomentCard({ href, moment }: { href: string | null; moment: Moment }) {
  const t = useExtracted();
  const dayText = useExamDayText();
  const copy = useMomentCopy(moment);

  if (!copy) {
    return null;
  }

  const Icon = ICONS[moment.stage];
  const showDay = moment.day && moment.stage !== "afterExam";

  return (
    <section aria-label={copy.title} className="flex flex-col gap-6" data-slot="exam-moment">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-5 shrink-0 items-center">
          <Icon className="text-muted-foreground size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-reading font-medium">{copy.title}</h2>
          {showDay && moment.day && (
            <p className="text-compact font-mono font-medium tabular-nums">{dayText(moment.day)}</p>
          )}
          <p className="text-muted-foreground text-compact leading-snug">
            {copy.lead && <span className="text-foreground">{copy.lead} </span>}
            {copy.body}
          </p>
        </div>
      </div>

      <ExamChecklist items={moment.checklist} tools={moment.tools} />

      {href && (
        <LearnLink
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "self-start")}
          href={href}
        >
          {moment.stage === "afterExam" ? t("Add your result") : t("See your exam")}
        </LearnLink>
      )}
    </section>
  );
}
