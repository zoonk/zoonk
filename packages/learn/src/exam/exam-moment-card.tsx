"use client";

import { type DayBeforePlan, type ExamMomentView } from "@zoonk/core/exams/view/contract";
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
  | "dayBefore"
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

function useDayBeforeBody({ dayBefore, work }: { dayBefore: DayBeforePlan; work: string }) {
  const t = useExtracted();

  switch (dayBefore) {
    case "mock":
      return t("Today is your short mock, then a look at what it finds. Then rest. {work}", {
        work,
      });
    case "learnAndMock":
      return t("Today goes to the topics that come up most, then a short mock. Then rest.");
    case "learn":
      return t("Today goes to the topics that come up most. Then rest.");
    case "review":
      return t(
        "Today is a full review of every topic, in your test's format, your weakest first. Then rest. {work}",
        { work },
      );
    case "light":
      return t("Today is a short, light review. Then rest. {work}", { work });
    default:
      return t("Today is a short, light review. Then rest. {work}", { work });
  }
}

function useWorkLine(moment: Moment): string {
  const t = useExtracted();

  const done =
    moment.mocksTaken > 0
      ? t(
          "You did {sessions, plural, =0 {# sessions} one {# session} other {# sessions}} and {mocks, plural, one {# mock exam} other {# mock exams}}.",
          { mocks: moment.mocksTaken, sessions: moment.sessionsDone },
        )
      : t("You did {sessions, plural, =0 {# sessions} one {# session} other {# sessions}}.", {
          sessions: moment.sessionsDone,
        });

  return moment.prepared ? `${done} ${t("You've prepared for this.")}` : done;
}

function useMomentCopy(moment: Moment): { body: string; title: string } | null {
  const t = useExtracted();
  const work = useWorkLine(moment);

  const dayBeforeBody = useDayBeforeBody({ dayBefore: moment.dayBefore, work });

  switch (moment.stage) {
    case "finalStretch":
      return {
        body: t(
          "The last days before the exam go to mixed review and mock exams. New topics wait, unless they weigh a lot and are quick.",
        ),
        title: t("The final stretch"),
      };
    case "dayBefore":
      return { body: dayBeforeBody, title: t("{exam} is tomorrow", { exam: moment.examName }) };
    case "examDay":
      return { body: work, title: t("{exam} is today", { exam: moment.examName }) };
    case "afterExam":
      return moment.resultReported
        ? null
        : {
            body: t(
              "When your official result comes out, add it here. It helps make estimates more accurate for everyone.",
            ),
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
    <section aria-label={copy.title} className="flex flex-col gap-4" data-slot="exam-moment">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-5 shrink-0 items-center">
          <Icon className="text-muted-foreground size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[0.9375rem] font-medium">{copy.title}</h2>
          {showDay && moment.day && (
            <p className="font-mono text-[0.8125rem] font-medium tabular-nums">
              {dayText(moment.day)}
            </p>
          )}
          <p className="text-muted-foreground text-[0.8125rem] leading-snug">{copy.body}</p>
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
