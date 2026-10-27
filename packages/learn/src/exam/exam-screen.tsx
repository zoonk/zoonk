"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { useExtracted, useFormatter } from "next-intl";
import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailLayout,
  DetailTitle,
} from "../_components/detail-page";
import { PageEyebrow } from "../_components/page";
import { useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { useFormatTimeOfDay } from "../_utils/time-format";
import { ReportProblemMenu } from "../feedback/content-vote-menu";
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

/**
 * The exam's days as one fact ("Nov 8 and Nov 15", by the Plan's date rule, with the year beyond
 * the next twelve months), and its start time once when every day shares it (ENEM's two Sundays
 * both start at 13:30), or on each day when they differ. A single day also names its weekday ("Sun,
 * Nov 8"), as the aside's days do; the month the learner named is said as that month ("March
 * 2027").
 */
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

  // The month the learner named stands for that month: no day in it is the exam's yet.
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

/**
 * "Exam · 34 days left" over the exam's name; "~34 days left" while the date is an estimate, heard
 * as "About 34 days left". Just "Exam" once the day is past.
 */
function ExamEyebrow() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const days = exam.daysLeft;

  if (days === null || days <= 0) {
    return <PageEyebrow>{t("Exam")}</PageEyebrow>;
  }

  if (!exam.daysEstimated) {
    return (
      <PageEyebrow>
        {t("Exam · {days, plural, =0 {The day is here} one {# day left} other {# days left}}", {
          days,
        })}
      </PageEyebrow>
    );
  }

  return (
    <PageEyebrow>
      <span aria-hidden="true">
        {t("Exam · {days, plural, one {~# day left} other {~# days left}}", { days })}
      </span>
      <span className="sr-only">
        {t("Exam · {days, plural, one {About # day left} other {About # days left}}", { days })}
      </span>
    </PageEyebrow>
  );
}

/**
 * Back to the page the learner came from (the Plan without one), from `lg` the sidebar's place;
 * once the hero scrolls away, the bar names the exam.
 */
function ExamBar() {
  const { exam, hrefs } = useExamScreen();
  return <LearnPageBar back={{ href: hrefs.back }} root title={exam.examName} />;
}

/**
 * Where the date shown comes from, when it isn't the notice's own day, under the exam's days in
 * the aside: the month the learner named (unless the notice's day is offered by the header), or
 * the days past editions suggest.
 */
function DateNote() {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (exam.days.length === 0) {
    return null;
  }

  if (exam.namedMonth) {
    // A month with no sitting gets no day from the notice: the card by the header says so.
    return exam.noticeDay || exam.noSitting ? null : (
      <p className="text-muted-foreground text-xs text-pretty">
        {t(
          "{document, select, notice {The month you told us. We'll tell you the day once the notice sets it.} other {The month you told us. We'll tell you the day once the official calendar sets it.}}",
          { document: exam.examDocument },
        )}
      </p>
    );
  }

  return exam.daysEstimated ? (
    <p className="text-muted-foreground text-xs text-pretty">
      {t(
        "{document, select, notice {Estimated from past editions. We'll tell you when the official notice is out.} other {Estimated from past editions. We'll tell you when the official dates are out.}}",
        { document: exam.examDocument },
      )}
    </p>
  ) : null;
}

/**
 * The notice's day when the plan counts down to another, with one tap to take it, or, for an exam
 * held several times a year with no sitting in the learner's month, the closest ones.
 */
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

/**
 * The exam's facts in one mono line ("November 14 and 21, 2027 · 1:30 PM · estimated from past
 * editions"), each fact kept whole, so a narrow line breaks between them, never inside one. The
 * month the learner named is theirs, not an estimate from past editions.
 */
function ExamFacts() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const days = useExamDays();
  const fromPastEditions = exam.daysEstimated && !exam.namedMonth;

  const facts = [...days, fromPastEditions && t("estimated from past editions")].filter(
    (fact): fact is string => Boolean(fact),
  );

  if (facts.length === 0) {
    return null;
  }

  return (
    <DetailFacts>
      {facts.map((fact, index) => (
        <span className="whitespace-nowrap" key={fact}>
          {index < facts.length - 1 ? `${fact} ·` : fact}
        </span>
      ))}
    </DetailFacts>
  );
}

/**
 * The exam at a glance: "Exam · 34 days left" over its name, its days and start time in one mono
 * line, and beside them from `md` the page's main action (a mock exam any time, from the host)
 * with its "…"; then the notice's day when the plan counts down to another.
 */
function ExamHero({ mockAction }: { mockAction: React.ReactNode }) {
  const t = useExtracted();
  const { exam } = useExamScreen();

  return (
    <>
      <DetailHero>
        <DetailHeroText>
          <ExamEyebrow />
          <DetailTitle>{exam.examName}</DetailTitle>
          <ExamFacts />
        </DetailHeroText>

        <DetailActions>
          {mockAction}
          <ReportProblemMenu label={t("Exam options")} screen="exam" />
        </DetailActions>
      </DetailHero>

      <ExamNoticeDay />
    </>
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
        day: exam.days[0] ?? null,
        dayBefore: exam.dayBefore,
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

/**
 * The exam's speaking: DELE, DELF, Goethe and Cambridge goals practice their paper task by task;
 * IELTS and TOEFL goals keep the language goal's speaking mock after moving to the exam goal.
 */
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

/**
 * The exam's page: its name, when it is and its main action, a mock exam any time; then under
 * their headers the moment it's in (final stretch, day before, exam day), "How did it go?" after
 * it, its mocks (the one running, the next one and the ones taken), how they went, what's on it
 * (when the notice doesn't set it out day by day) and its speaking (its paper task by task, or the
 * IELTS or TOEFL speaking mock). In the aside from 72rem (after them under it): the exam day by
 * day as its notice sets it out, how the score works and where its date comes from. How ready the
 * learner is lives on the Plan, so it isn't repeated.
 */
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
  /** "Take a mock exam" whenever the learner wants (`MockEntryButton`), beside the title. */
  mockAction?: React.ReactNode;
  /** The speaking task a link asked to open (a result's "Next"), by its key. */
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
            <DateNote />
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
          <ExamMoment />
          <ExamResultSection />
          <ExamMocks offered={mockAction !== null} />
          <ExamMockProgress />
          {exam.format.length === 0 && <ExamMapSection />}
          <ExamSpeaking />
        </DetailContent>
      </DetailLayout>
    </ExamScreenProvider>
  );
}
