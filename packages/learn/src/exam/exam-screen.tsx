"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { useExtracted } from "next-intl";
import { SpeakingMockCard } from "../language/progress/speaking-mock-card";
import {
  type ExamActions,
  type ExamHrefs,
  ExamScreenProvider,
  useExamScreen,
} from "./exam-context";
import { useExamDayText } from "./exam-labels";
import { ExamMapSection } from "./exam-map-section";
import { ExamMocksSection } from "./exam-mocks-section";
import { ExamMomentCard } from "./exam-moment-card";
import { ExamResultSection } from "./exam-result-section";
import { ExamScoringSection } from "./exam-scoring-section";

export type { ExamActions, ExamHrefs } from "./exam-context";

function ExamHeader() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const dayText = useExamDayText();
  const counting = exam.daysLeft !== null && exam.daysLeft > 0;

  return (
    <header className="flex flex-col gap-2">
      <p className="text-muted-foreground text-sm font-medium">{exam.examName}</p>
      <h1 className="in-data-[mode=fun]:font-fun-display text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
        {counting
          ? t("{days, plural, one {# day left} other {# days left}}", { days: exam.daysLeft ?? 0 })
          : t("Your exam")}
      </h1>
      {exam.days.length > 0 && (
        <ul className="text-muted-foreground flex flex-col gap-0.5 text-sm">
          {exam.days.map((day) => (
            <li key={day.date}>
              {day.label
                ? t("{label}: {day}", { day: dayText(day), label: day.label })
                : dayText(day)}
            </li>
          ))}
        </ul>
      )}
      {exam.daysEstimated && exam.days.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {t("Estimated from past editions until the official notice is out.")}
        </p>
      )}
    </header>
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
        resultReported: true,
        sessionsDone: exam.sessionsDone,
        stage: exam.stage,
      }}
    />
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
 * The exam screen ("Your exam"), the same in both modes: when it is, the moment it's in (final
 * stretch, day before, exam day), "How did it go?" after it, the exam map, how it's scored with
 * the strategy that follows, the IELTS or TOEFL speaking mock, and the mocks so far with the
 * estimated score.
 */
export function ExamScreen({
  actions,
  exam,
  hrefs,
}: {
  actions: ExamActions;
  exam: ExamView;
  hrefs: ExamHrefs;
}) {
  return (
    <ExamScreenProvider value={{ actions, exam, hrefs }}>
      <div className="flex flex-col gap-8" data-slot="exam-screen">
        <ExamHeader />
        <ExamMoment />
        <ExamResultSection />
        <ExamMapSection />
        <ExamScoringSection />
        <ExamSpeakingMock />
        <ExamMocksSection />
      </div>
    </ExamScreenProvider>
  );
}
