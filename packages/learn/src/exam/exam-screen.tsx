"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import {
  DetailActions,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailTitle,
} from "@zoonk/ui/components/detail";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { DetailAside, DetailContent, DetailLayout } from "../_components/detail-page";
import { PageEyebrow } from "../_components/page";
import { FactSegments } from "../_components/task-meta";
import { useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { useFormatTimeOfDay } from "../_utils/time-format";
import { ReportProblemMenu } from "../feedback/content-feedback-menu";
import { SpeakingPaperSection } from "../language/exam-speaking/speaking-paper-section";
import { SpeakingMockCard } from "../language/progress/speaking-mock-card";
import { NoticeDatesCard } from "../plan/notice-day";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { LearnPageBar } from "../shell/learn-bar";
import {
  type ExamActions,
  type ExamHrefs,
  ExamScreenProvider,
  useExamScreen,
} from "./exam-context";
import { ExamFormatSection } from "./exam-format-section";
import { useExamDayDate } from "./exam-labels";
import { ExamMapSection } from "./exam-map-section";
import { ExamMockProgress } from "./exam-mock-progress";
import { ExamMocks } from "./exam-mocks-section";
import { ExamMomentCard } from "./exam-moment-card";
import { ExamResultSection } from "./exam-result-section";
import { ExamScoringSection } from "./exam-scoring-section";

export type { ExamActions, ExamHrefs } from "./exam-context";

function useExamDays(): string[] {
  const format = useFormatter();
  const { exam } = useExamScreen();
  const formatDate = useFormatIsoDate();
  const formatPlanDate = useFormatPlanDate();
  const dayDate = useExamDayDate();
  const formatTimeOfDay = useFormatTimeOfDay();
  const startTimes = new Set(exam.days.map((day) => day.startTime));
  const sharedTime = startTimes.size === 1 ? (exam.days[0]?.startTime ?? null) : null;
  const timePerDay = startTimes.size > 1;

  if (exam.namedMonth) {
    return exam.days.map((day) => toLabelCase(formatDate(day.date, "month")));
  }

  const days = exam.days.map((day) => {
    const date = exam.days.length === 1 ? dayDate(day.date) : formatPlanDate(day.date);

    const time = !sharedTime && day.startTime ? formatTimeOfDay(day.startTime) : null;

    return time ? `${date} · ${time}` : date;
  });

  const dates =
    !timePerDay && days.length > 1 ? [format.list(days, { type: "conjunction" })] : days;

  return sharedTime ? [...dates, formatTimeOfDay(sharedTime)] : dates;
}

function ExamEyebrow() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const days = exam.daysLeft;

  // The day before, the card under the title says "tomorrow": the count would say it twice.
  if (days === null || days <= 0 || exam.stage === "dayBefore") {
    return <PageEyebrow>{t("Exam")}</PageEyebrow>;
  }

  return (
    <PageEyebrow>
      {t("Exam · {days, plural, =0 {The day is here} one {# day left} other {# days left}}", {
        days,
      })}
    </PageEyebrow>
  );
}

/** On a phone the options sit across from the back arrow every day, so the page's top never moves. */
function ExamBar() {
  const t = useExtracted();
  const { exam, hrefs } = useExamScreen();

  return (
    <div className="contents lg:hidden">
      <LearnPageBar back={{ href: hrefs.back }} root title={exam.examName}>
        <ReportProblemMenu label={t("Exam options")} place="bar" screen="exam" />
      </LearnPageBar>
    </div>
  );
}

/** Why the dates may change, behind a tap: the page says once that they're estimated. */
function useDateTag(): { label: string; text: string } | null {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (exam.days.length === 0) {
    return null;
  }

  if (exam.namedMonth) {
    return exam.noticeDay || exam.noSitting
      ? null
      : { label: t("Day not set yet"), text: t("We'll tell you the day once it's set.") };
  }

  return exam.daysEstimated
    ? {
        label: t("Estimated dates"),
        text: t("From past editions. We'll tell you when the official dates are out."),
      }
    : null;
}

function DateTag() {
  const tag = useDateTag();

  if (!tag) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        className="hit-area text-muted-foreground decoration-faint focus-visible:ring-ring/50 relative self-start rounded-md text-xs underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-[3px]"
        data-slot="exam-date-tag"
      >
        {tag.label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PopoverHeader>
          <PopoverDescription>{tag.text}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

function ExamNoticeDay() {
  const { actions, exam } = useExamScreen();

  return (
    <NoticeDatesCard
      document={exam.examDocument}
      noSitting={exam.noSitting}
      noticeDay={exam.noticeDay}
      onUse={actions.setDate}
    />
  );
}

function ExamFacts() {
  const days = useExamDays();

  if (days.length === 0) {
    return null;
  }

  return (
    <>
      <DetailFacts>
        <FactSegments facts={days} />
      </DetailFacts>
      <DateTag />
    </>
  );
}

/** The day before, on the day and after it, the exam leads the page and a mock exam is one row. */
function isLastDays(stage: ExamView["stage"]): boolean {
  return stage === "dayBefore" || stage === "examDay" || stage === "afterExam";
}

function ExamHero({ mockAction }: { mockAction: React.ReactNode }) {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const main = isLastDays(exam.stage) ? null : mockAction;

  return (
    <DetailHero>
      <DetailHeroText>
        <ExamEyebrow />
        <DetailTitle>{exam.examName}</DetailTitle>
        <ExamFacts />
      </DetailHeroText>

      <DetailActions className={cn(!main && "max-lg:hidden")}>
        {main}
        <ReportProblemMenu className="max-lg:hidden" label={t("Exam options")} screen="exam" />
      </DetailActions>
    </DetailHero>
  );
}

function ExamMoment() {
  const { exam } = useExamScreen();

  if (exam.stage === "preparing") {
    return null;
  }

  return (
    <ExamMomentCard
      href={null}
      moment={{
        checklist: exam.stage === "dayBefore" || exam.stage === "examDay" ? exam.checklist : [],
        // The date is under the page's title already.
        day: null,
        examName: exam.examName,
        mocksTaken: exam.mocks.length,
        prepared: exam.prepared,
        resultReported: true,
        sessionsDone: exam.sessionsDone,
        stage: exam.stage,
        tools: exam.tools,
      }}
    />
  );
}

function ExamSpeaking() {
  const { actions, exam, hrefs, openSpeakingTask } = useExamScreen();

  if (exam.speaking) {
    return (
      <SpeakingPaperSection
        onStart={actions.startExamTask}
        openTask={openSpeakingTask}
        paper={exam.speaking}
        resultHref={hrefs.examTask}
      />
    );
  }

  if (!exam.speakingMock) {
    return null;
  }

  return (
    <SpeakingMockCard
      exam={exam.speakingMock}
      onStart={actions.startSpeakingMock}
      paused={exam.speakingMockPaused}
    />
  );
}

export function ExamScreen({
  actions,
  exam,
  hrefs,
  mockAction = null,
  openSpeakingTask = null,
}: {
  actions: ExamActions;
  exam: ExamView;
  hrefs: ExamHrefs;
  mockAction?: React.ReactNode;
  openSpeakingTask?: string | null;
}) {
  const t = useExtracted();

  return (
    <ExamScreenProvider value={{ actions, exam, hrefs, openSpeakingTask }}>
      <DetailLayout
        aside={
          <>
            {exam.format.length > 0 && <ExamFormatSection />}
            <ExamScoringSection />
          </>
        }
        asideLabel={t("About the exam")}
        bar={<ExamBar />}
        data-slot="exam-screen"
      >
        <DetailAside>
          <ExamHero mockAction={mockAction} />
        </DetailAside>

        <DetailContent>
          <ExamNoticeDay />
          <ExamMoment />
          <ExamResultSection />
          <ExamMocks entry={isLastDays(exam.stage) && mockAction !== null} />
          <ExamMockProgress />
          {exam.format.length === 0 && <ExamMapSection />}
          <ExamSpeaking />
        </DetailContent>
      </DetailLayout>
    </ExamScreenProvider>
  );
}
