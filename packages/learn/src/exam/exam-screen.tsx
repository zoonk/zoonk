"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { useExtracted, useFormatter } from "next-intl";
import { DateTile } from "../_components/date-tile";
import {
  DetailActions,
  DetailAside,
  DetailContent,
  DetailEyebrow,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailLayout,
  DetailTitle,
} from "../_components/detail-page";
import { ListGroup } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { PlusNotice } from "../_components/plus-lock";
import { useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { useFormatTimeOfDay } from "../_utils/time-format";
import { ReportProblemMenu } from "../feedback/content-vote-menu";
import { SpeakingPaperSection } from "../language/exam-speaking/speaking-paper-section";
import { SpeakingMockCard } from "../language/progress/speaking-mock-card";
import { NoticeDatesCard } from "../plan/notice-day";
import { LearnPageBar } from "../shell/learn-bar";
import {
  type ExamActions,
  type ExamHrefs,
  ExamScreenProvider,
  useExamScreen,
} from "./exam-context";
import { ExamFormatSection } from "./exam-format-section";
import { ExamMapSection } from "./exam-map-section";
import { ExamMockProgress } from "./exam-mock-progress";
import { ExamMocksSection } from "./exam-mocks-section";
import { ExamMomentCard } from "./exam-moment-card";
import { ExamNextMock } from "./exam-next-mock";
import { ExamResultSection } from "./exam-result-section";
import { ExamScoringSection } from "./exam-scoring-section";

export type { ExamActions, ExamHrefs } from "./exam-context";

const MOCKS_TITLE_ID = "exam-mocks-section-title";

/**
 * The exam's days as one fact ("November 8 and 15"), and its start time once when every day shares
 * it (ENEM's two Sundays both start at 13:30), or on each day when they differ. A single day also
 * names its weekday; the month the learner named is said as that month ("March 2027").
 */
function useExamDays(): string[] {
  const format = useFormatter();
  const { exam } = useExamScreen();
  const formatDate = useFormatIsoDate();
  const formatTimeOfDay = useFormatTimeOfDay();
  const startTimes = new Set(exam.days.map((day) => day.startTime));
  const sharedTime = startTimes.size === 1 ? (exam.days[0]?.startTime ?? null) : null;
  const timePerDay = startTimes.size > 1;

  // The month the learner named stands for that month: no day in it is the exam's yet.
  if (exam.namedMonth) {
    return exam.days.map((day) => toLabelCase(formatDate(day.date, "month")));
  }

  const days = exam.days.map((day) => {
    const date =
      exam.days.length === 1
        ? `${formatDate(day.date, "weekday")}, ${formatDate(day.date, "long")}`
        : formatDate(day.date, "long");

    const time = !sharedTime && day.startTime ? formatTimeOfDay(day.startTime) : null;

    return time ? `${date} · ${time}` : date;
  });

  const dates =
    !timePerDay && days.length > 1 ? [format.list(days, { type: "conjunction" })] : days;

  return sharedTime ? [...dates, formatTimeOfDay(sharedTime)] : dates;
}

/** "34 days left", or "About 34 days left" while the date is an estimate; null once it's past. */
function useDaysLeft(): string | null {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (exam.daysLeft === null || exam.daysLeft <= 0) {
    return null;
  }

  return exam.daysEstimated
    ? t("{days, plural, one {About # day left} other {About # days left}}", { days: exam.daysLeft })
    : t("{days, plural, =0 {The day is here} one {# day left} other {# days left}}", {
        days: exam.daysLeft,
      });
}

/** Back to the Journey; once the hero scrolls away, the bar names the exam. */
function ExamBar() {
  const t = useExtracted();
  const { exam, hrefs } = useExamScreen();

  return <LearnPageBar back={{ href: hrefs.back, label: t("Journey") }} title={exam.examName} />;
}

/**
 * Where the date shown comes from, when it isn't the notice's own day: the month the learner named
 * (unless the notice's day is offered right under it), or the days past editions suggest.
 */
function DateNote() {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (exam.days.length === 0) {
    return null;
  }

  if (exam.namedMonth) {
    // A month with no sitting gets no day from the notice: the card under it says so.
    return exam.noticeDay || exam.noSitting ? null : (
      <p className="text-muted-foreground px-1 text-xs">
        {t(
          "{document, select, notice {The month you told us. We'll tell you the day once the notice sets it.} other {The month you told us. We'll tell you the day once the official calendar sets it.}}",
          { document: exam.examDocument },
        )}
      </p>
    );
  }

  return exam.daysEstimated ? (
    <p className="text-muted-foreground px-1 text-xs">
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
 * The exam at a glance: its first day as a calendar page (its month, for the month the learner
 * named), its name over "About the exam", its days, start time and the days left in one line, then
 * the page's main action (a mock exam any time, from the host) with its "…", and the notice's day
 * when the plan counts down to another.
 */
function ExamHero({ mockAction }: { mockAction: React.ReactNode }) {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const [firstDay] = exam.days;
  const days = useExamDays();
  const daysLeft = useDaysLeft();
  const facts = [...days, daysLeft].filter(Boolean);

  return (
    <>
      <DetailHero>
        {firstDay && <DateTile isoDate={firstDay.date} monthOnly={exam.namedMonth} />}
        <DetailHeroText>
          <DetailEyebrow>{exam.examName}</DetailEyebrow>
          <DetailTitle>{t("About the exam")}</DetailTitle>
          {facts.length > 0 && <DetailFacts>{facts.join(" · ")}</DetailFacts>}
        </DetailHeroText>
      </DetailHero>

      <DateNote />

      <DetailActions>
        {mockAction}
        <ReportProblemMenu label={t("Exam options")} screen="exam" />
      </DetailActions>

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
 * The exam's mocks under one header: the plan's next one, how they went over time, then the ones
 * taken so far. Without Plus the mocks and their progress show all the same, marked Plus, with the
 * one notice of what Plus unlocks under the next one (taking one any time is the page's main
 * action, marked Plus too). The section leaves itself out when it has nothing to show.
 */
function ExamMocks({ offered }: { offered: boolean }) {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const locked = exam.mocksRequirePlus && (exam.nextMock !== null || offered);

  if (!exam.nextMock && exam.mocks.length === 0 && !locked) {
    return null;
  }

  return (
    <PageSection aria-labelledby={MOCKS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={MOCKS_TITLE_ID}>{t("Mock exams")}</PageSectionTitle>
      </PageSectionHeader>

      {exam.nextMock && (
        <ListGroup>
          <ExamNextMock />
        </ListGroup>
      )}

      {locked && (
        <PlusNotice>
          {t(
            "Mock exams come with Plus: whenever you want, every week in your plan, and your progress over time.",
          )}
        </PlusNotice>
      )}

      <ExamMockProgress />
      <ExamMocksSection />
    </PageSection>
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

  return <SpeakingMockCard exam={exam.speakingMock} onStart={actions.startSpeakingMock} />;
}

/**
 * "About the exam": when it is (the detail page's hero) with its main action, a mock exam any
 * time; then under their headers the moment it's in (final stretch, day before, exam day), "How
 * did it go?" after it, its mocks (the next one and the ones taken), the exam day by day as its
 * notice sets it out (what's on it, when the notice doesn't), how the score works and the exam's
 * speaking (its paper task by task, or the IELTS or TOEFL speaking mock). How ready the learner is lives on the Journey, so it isn't repeated.
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
  /** "Take a mock exam" whenever the learner wants (`MockEntryButton`), under the hero. */
  mockAction?: React.ReactNode;
  /** The speaking task a link asked to open (a result's "Next"), by its key. */
  openSpeakingTask?: string | null;
}) {
  return (
    <ExamScreenProvider value={{ actions, exam, hrefs, openSpeakingTask }}>
      <div className="flex flex-col gap-8" data-slot="exam-screen">
        <ExamBar />

        <DetailLayout>
          <DetailAside>
            <ExamHero mockAction={mockAction} />
          </DetailAside>

          <DetailContent>
            <ExamMoment />
            <ExamResultSection />
            <ExamMocks offered={mockAction !== null} />
            {exam.format.length > 0 ? <ExamFormatSection /> : <ExamMapSection />}
            <ExamScoringSection />
            <ExamSpeaking />
          </DetailContent>
        </DetailLayout>
      </div>
    </ExamScreenProvider>
  );
}
