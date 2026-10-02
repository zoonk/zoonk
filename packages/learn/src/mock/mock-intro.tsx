"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ClockIcon, EyeOffIcon, ScaleIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { BigChallengeCard } from "../_components/big-challenge-card";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration, useFormatTimeOfDay } from "../_utils/time-format";
import { BuddySpeech, useBuddyLine } from "../buddies/buddy-lines";
import { useExperienceMode } from "../mode-provider";
import { TaskMainButton } from "../shell/task-frame";
import { ExamDayChecklist } from "./exam-day-checklist";
import { useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";
import { useMockTitle, useScoringRule, useSectionName } from "./mock-labels";

function IntroFooter() {
  const t = useExtracted();
  const mode = useExperienceMode();
  const { runner } = useMockScreen();

  return (
    <>
      <MockStepStatus />
      <TaskMainButton
        busy={runner.busy === "start"}
        disabled={runner.pending}
        onClick={() => void runner.start()}
      >
        {runner.busy === "start" && t("Starting…")}
        {runner.busy !== "start" && (mode === "fun" ? t("I'm in") : t("Start the mock exam"))}
      </TaskMainButton>
      {runner.view.canMove && (
        <Button
          className="w-full"
          disabled={runner.pending}
          onClick={() => void runner.moveToMonday()}
          size="lg"
          variant="ghost"
        >
          {t("Move to Monday")}
        </Button>
      )}
    </>
  );
}

function SectionList() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const duration = useFormatDuration();
  const sectionName = useSectionName();

  return (
    <ol className="flex flex-col gap-2">
      {runner.view.sections.map((section) => (
        <li
          className="border-border in-data-[mode=fun]:fun-glass flex items-baseline justify-between gap-3 rounded-2xl border px-4 py-3 in-data-[mode=fun]:border-transparent"
          key={section.index}
        >
          <span className="min-w-0 font-medium">{sectionName(section.name)}</span>
          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
            {t("{count, plural, one {# question} other {# questions}} · {time}", {
              count: section.questions,
              time: duration(section.minutes),
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Rules() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { view } = runner;
  const duration = useFormatDuration();
  const clockTime = useFormatTimeOfDay();
  const rule = useScoringRule();

  const rules = [
    {
      icon: ClockIcon,
      text: view.startTime
        ? t(
            "{time} on the clock. The real exam starts at {start}: taking it then rehearses the day.",
            { start: clockTime(view.startTime), time: duration(view.minutes) },
          )
        : t("{time} on the clock, like the real exam.", { time: duration(view.minutes) }),
    },
    { icon: EyeOffIcon, text: t("No feedback until the end. Flag questions to come back to.") },
    { icon: ScaleIcon, text: rule(view.scoring) },
  ];

  return (
    <ul className="flex flex-col gap-3">
      {rules.map(({ icon: Icon, text }) => (
        <li className="flex items-start gap-3 text-sm" key={text}>
          <LineMarker aria-hidden="true">
            <Icon className="text-muted-foreground in-data-[mode=fun]:text-fun-accent-cyan size-4" />
          </LineMarker>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Focus: the mock said plainly, with its sections, its rules and the day's checklist. */
function FocusMockIntro() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { view } = runner;
  const title = useMockTitle();
  const formatDate = useFormatIsoDate();

  return (
    <MockFrame footer={<IntroFooter />}>
      <div className="flex flex-col gap-2 pt-6">
        <p className="text-muted-foreground text-sm font-medium">
          {view.fullLength
            ? t("Full mock exam · {date}", { date: formatDate(view.date, "long") })
            : t("Weekly mock exam · {date}", { date: formatDate(view.date, "long") })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title(view)}</h1>
        {view.examName && <p className="text-muted-foreground">{view.examName}</p>}
      </div>

      <SectionList />
      <Rules />
      <ExamDayChecklist items={view.checklist} />
    </MockFrame>
  );
}

/** Fun: the week's Big Challenge as an event, at the real exam's time, with the buddy cheering. */
function FunMockIntro() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();
  const clockTime = useFormatTimeOfDay();
  const { buddy, runner } = useMockScreen();
  const { view } = runner;
  const title = useMockTitle();
  const line = useBuddyLine("bigChallenge");
  const when = formatDate(view.date, "weekdayShort");

  return (
    <MockFrame footer={<IntroFooter />}>
      {buddy && (
        <div className="flex items-end gap-3 pt-2">
          <Buddy
            beltColor={buddy.beltColor}
            className="size-24 shrink-0"
            energy={buddy.energy}
            expression="kind"
            glasses={buddy.glasses}
            kind={buddy.kind}
            studiedToday={buddy.studiedToday}
          />
          <BuddySpeech>{line}</BuddySpeech>
        </div>
      )}

      <BigChallengeCard
        eyebrow={
          view.startTime
            ? t("{day}, {date} · {time}", {
                date: formatDate(view.date, "day"),
                day: when,
                time: clockTime(view.startTime),
              })
            : t("{day}, {date}", { date: formatDate(view.date, "day"), day: when })
        }
        reward={t("+{points} Brain Power and your updated preparation", {
          points: format.number(view.brainPower),
        })}
        subtitle={title(view)}
      />

      <SectionList />
      <Rules />
      <ExamDayChecklist items={view.checklist} />
    </MockFrame>
  );
}

export function MockIntro() {
  const mode = useExperienceMode();
  return mode === "fun" ? <FunMockIntro /> : <FocusMockIntro />;
}
