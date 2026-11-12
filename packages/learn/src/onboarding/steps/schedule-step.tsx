"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { type LanguageAim, type LanguageAimView } from "@zoonk/core/language/aims";
import { type PlanReadiness } from "@zoonk/core/plans/time-advice-contract";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { Button } from "@zoonk/ui/components/button";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { DailyTimePicker } from "../../_components/daily-time-picker";
import { type GoalDate, TimeAnswer } from "../../_components/time-answer";
import { getMarkedTimes, getOffer } from "../../_utils/time-answer";
import { type GenerationFirstLesson, type GenerationRun } from "../../generation/generation-run";
import { type OnboardingActions } from "../onboarding-actions";
import { OnboardingQuestionShown } from "../onboarding-clock";
import { PlanReceipt } from "../plan-receipt";
import { type LibraryCourseLink, PlanWait } from "./plan-wait";
import { ScheduleAim, getAimAhead } from "./schedule-aim";
import { type GoalsTogether, toPickedMinutes, waitsToSave } from "./schedule-time";
import { StepForm } from "./step-form";
import { EVERY_DAY, WeekdayToggles, WeekendMinutes } from "./study-week";
import {
  type Schedule,
  type ScheduleActions,
  type ScheduleDraft,
  useSchedule,
} from "./use-schedule";
import {
  WAITING_RUN,
  getNoticeStop,
  getPlanWait,
  getWaitRun,
  isPlanMade,
  isRunStopped,
} from "./wait-run";

function getGoalDate(schedule: Schedule): GoalDate | null {
  const shown = schedule.found.found ?? schedule.found.last;

  return schedule.dated && shown?.targetDate
    ? { isoDate: shown.targetDate, namedMonth: shown.targetDateNamedMonth }
    : null;
}

function getScheduleAnswer(schedule: Schedule): OnboardingAnswerInput | null {
  const { days, weekend } = schedule.week;

  if (schedule.minutes === null) {
    return null;
  }

  return {
    dailyMinutes: schedule.minutes,
    question: "schedule",
    studyDays: days.length === EVERY_DAY.length ? undefined : days,
    timeZone: getLocalTimeZone(),
    weekendMinutes: weekend ?? undefined,
  };
}

/** The answer leads: the time, then the one line on what it gets the learner. */
function DateLinkLabel({ dated, exam }: { dated: boolean; exam: boolean }) {
  const t = useExtracted();

  if (exam) {
    return t("Change exam date");
  }

  return dated ? t("Change end date") : t("Choose an end date");
}

function ScheduleTime({
  aim,
  exam,
  schedule,
}: {
  aim: string | null;
  exam: boolean;
  schedule: Schedule;
}) {
  const t = useExtracted();
  const { found, minutes, setPicked, shown } = schedule;
  const marked = getMarkedTimes(found.found);

  return (
    <div className="flex flex-col gap-2">
      <OnboardingQuestionShown step="schedule" />

      <DailyTimePicker
        full={marked.full}
        label={t("Time a day")}
        minutes={minutes}
        onChange={(next) =>
          setPicked(
            toPickedMinutes({
              first: found.first,
              found: found.found ?? found.last,
              minutes: next,
            }),
          )
        }
        stale={schedule.stale}
        suggested={marked.suggested}
      />

      <TimeAnswer
        aim={aim}
        date={getGoalDate(schedule)}
        exam={exam}
        line={shown.line}
        minutes={minutes}
        offer={getOffer({ found: shown.found, line: shown.line, minutes })}
        onRetry={found.failed ? found.covering.restart : schedule.timeAdvice.restart}
        onUseOffer={(offer) =>
          setPicked(toPickedMinutes({ first: found.first, found: found.found, minutes: offer }))
        }
        split={schedule.split}
        updating={shown.updating}
      />
    </div>
  );
}

function ScheduleWeek({ minutes, week }: { minutes: number; week: Schedule["week"] }) {
  return (
    <div className="flex flex-col gap-3">
      <WeekdayToggles days={week.days} onChange={week.setDays} />

      {week.studiesOnWeekends && (
        <WeekendMinutes
          checked={week.weekendOn}
          minutes={week.weekendPicked ?? minutes}
          onChange={week.setWeekendPicked}
          onCheckedChange={week.setWeekendOn}
        />
      )}
    </div>
  );
}

export function ScheduleStep({
  dated,
  draft,
  exam = false,
  findTimeToCover,
  firstLesson,
  getTimeAdvice,
  goal,
  languageAim,
  lessonHref,
  library,
  onAnswer,
  onChangeAim,
  onChangeDate,
  pending,
  planReadiness,
  readWarmUp,
  recommendedMinutes,
  run,
  startsOnRecommended,
  together,
}: ScheduleActions & {
  dated: boolean;
  draft: ScheduleDraft | null;
  exam?: boolean;
  firstLesson: GenerationFirstLesson | null;
  goal: GoalView;
  languageAim: LanguageAimView | null;
  lessonHref: (lessonId: string) => string;
  library: LibraryCourseLink | null;
  onAnswer: (input: OnboardingAnswerInput) => void;
  onChangeAim: (aim: LanguageAim) => Promise<boolean>;
  onChangeDate: (draft: ScheduleDraft) => void;
  pending: boolean;
  planReadiness: PlanReadiness;
  readWarmUp: OnboardingActions["readWarmUp"];
  recommendedMinutes: number;
  run: GenerationRun | null;
  startsOnRecommended: boolean;
  together: GoalsTogether;
}) {
  const t = useExtracted();

  const aim = getAimAhead(languageAim);

  const schedule = useSchedule({
    actions: { findTimeToCover, getTimeAdvice },
    aim: languageAim?.aim ?? null,
    dated,
    draft,
    goal,
    paused: isRunStopped(run),
    planMade: isPlanMade(run),
    recommendedMinutes,
    startsOnRecommended,
    together,
  });

  const wait = getPlanWait({ gate: schedule.gate, opened: planReadiness, run });

  return (
    <PlanWait
      firstLesson={firstLesson}
      lessonHref={lessonHref}
      library={library}
      next="timeQuestion"
      notice={{ stopped: getNoticeStop({ poll: schedule.gate, run }) }}
      readWarmUp={readWarmUp}
      run={getWaitRun({ poll: schedule.gate, run: run ?? WAITING_RUN })}
      wait={wait}
    >
      <StepForm
        canContinue={schedule.week.days.length > 0 && schedule.minutes !== null}
        onContinue={() => {
          const answer = getScheduleAnswer(schedule);

          if (answer) {
            onAnswer(answer);
          }
        }}
        pending={pending || waitsToSave({ line: schedule.line, picked: schedule.picked })}
        rail={<PlanReceipt goal={goal} />}
        title={t("How much time can you study each day?")}
      >
        <ScheduleTime aim={aim} exam={exam} schedule={schedule} />
        <ScheduleWeek minutes={schedule.minutes ?? recommendedMinutes} week={schedule.week} />
        <ScheduleAim
          endDate={schedule.shown.line.kind === "finish" ? schedule.shown.line.endDate : null}
          languageAim={languageAim}
          onChangeAim={onChangeAim}
          readEnd={schedule.readAimEnd}
        />
        <Button
          className="self-start"
          disabled={pending}
          focusableWhenDisabled
          onClick={() => onChangeDate(schedule.draft)}
          type="button"
          variant="link"
        >
          <DateLinkLabel dated={schedule.dated} exam={exam} />
        </Button>
      </StepForm>
    </PlanWait>
  );
}
