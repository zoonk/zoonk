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
import { useFormatTimeOfDay } from "../_utils/time-format";
import { ReportProblemMenu } from "../feedback/content-vote-menu";
import { SpeakingMockCard } from "../language/progress/speaking-mock-card";
import { LearnPageBar } from "../shell/learn-bar";
import {
  type ExamActions,
  type ExamHrefs,
  ExamScreenProvider,
  useExamScreen,
} from "./exam-context";
import { ExamFormatSection } from "./exam-format-section";
import { ExamMapSection } from "./exam-map-section";
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
 * names its weekday.
 */
function useExamDays(): string[] {
  const format = useFormatter();
  const { exam } = useExamScreen();
  const formatDate = useFormatIsoDate();
  const formatTimeOfDay = useFormatTimeOfDay();
  const startTimes = new Set(exam.days.map((day) => day.startTime));
  const sharedTime = startTimes.size === 1 ? (exam.days[0]?.startTime ?? null) : null;
  const timePerDay = startTimes.size > 1;

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
 * The exam at a glance: its first day as a calendar page, its name over "About the exam", its
 * days, start time and the days left in one line, then the page's main action (a mock exam any
 * time, from the host) with its "…".
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
        {firstDay && <DateTile isoDate={firstDay.date} />}
        <DetailHeroText>
          <DetailEyebrow>{exam.examName}</DetailEyebrow>
          <DetailTitle>{t("About the exam")}</DetailTitle>
          {facts.length > 0 && <DetailFacts>{facts.join(" · ")}</DetailFacts>}
        </DetailHeroText>
      </DetailHero>

      {exam.daysEstimated && exam.days.length > 0 && (
        <p className="text-muted-foreground px-1 text-xs">
          {t("Estimated from past editions. We'll tell you when the official notice is out.")}
        </p>
      )}

      <DetailActions>
        {mockAction}
        <ReportProblemMenu label={t("Exam options")} screen="exam" />
      </DetailActions>
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
      }}
    />
  );
}

/**
 * The exam's mocks under one header: the plan's next one, then the ones taken so far. Without Plus
 * the mocks show all the same, marked Plus, with the one notice of what Plus unlocks under them
 * (taking one any time is the page's main action, marked Plus too). The section leaves itself out
 * when it has nothing to show.
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
          {t("Mock exams come with Plus: whenever you want, and every week in your plan.")}
        </PlusNotice>
      )}

      <ExamMocksSection />
    </PageSection>
  );
}

/** IELTS and TOEFL goals keep the language goal's speaking mock after moving to the exam goal. */
function ExamSpeakingMock() {
  const { actions, exam } = useExamScreen();

  if (!exam.speakingMock) {
    return null;
  }

  return <SpeakingMockCard exam={exam.speakingMock} onStart={actions.startSpeakingMock} />;
}

/**
 * "About the exam": when it is (the detail page's hero) with its main action, a mock exam any
 * time; then under their headers the moment it's in (final stretch, day before, exam day), "How
 * did it go?" after it, its mocks (the next one and the ones taken), the exam day by day as its
 * notice sets it out (what's on it, when the notice doesn't), how the score works and the IELTS
 * or TOEFL speaking mock. How ready the learner is lives on the Journey, so it isn't repeated.
 */
export function ExamScreen({
  actions,
  exam,
  hrefs,
  mockAction = null,
}: {
  actions: ExamActions;
  exam: ExamView;
  hrefs: ExamHrefs;
  /** "Take a mock exam" whenever the learner wants (`MockEntryButton`), under the hero. */
  mockAction?: React.ReactNode;
}) {
  return (
    <ExamScreenProvider value={{ actions, exam, hrefs }}>
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
            <ExamSpeakingMock />
          </DetailContent>
        </DetailLayout>
      </div>
    </ExamScreenProvider>
  );
}
