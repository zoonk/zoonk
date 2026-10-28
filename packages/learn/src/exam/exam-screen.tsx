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

function ExamBar() {
  const { exam, hrefs } = useExamScreen();
  return <LearnPageBar back={{ href: hrefs.back }} root title={exam.examName} />;
}

function DateNote() {
  const t = useExtracted();
  const { exam } = useExamScreen();

  if (exam.days.length === 0) {
    return null;
  }

  if (exam.namedMonth) {
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
