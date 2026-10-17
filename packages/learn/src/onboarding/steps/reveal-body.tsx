"use client";

import { type PlanNumbers } from "@zoonk/core/plans/numbers-contract";
import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment, useState } from "react";
import {
  DETAIL_PRIMARY_CLASS,
  DetailActions,
  DetailHero,
  DetailHeroText,
} from "../../_components/detail-page";
import { SectionLabel } from "../../_components/section-label";
import { SuccessEyebrow } from "../../_components/success-eyebrow";
import { daysUntilIsoDate } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { usePlanEndText } from "../../journey/use-phase-when";
import { LearnLink } from "../../learn-link";
import { PlanChoices } from "../../plan/plan-choices";
import { usePlanScreen } from "../../plan/plan-context";
import { PlanEditor } from "../../plan/plan-editor";
import { OnboardingColumn, OnboardingTitle } from "../onboarding-frame";
import { SavePlanNote } from "../save-plan-note";
import { UsualStructureNote } from "./notice-reading";
import { AreaWeights, PlanChapterList, PlanPhasesBar } from "./plan-shape";
import { RevealCoverage } from "./reveal-coverage";
import { RevealNoticeDay } from "./reveal-notice-day";

const MINUTES_PER_HOUR = 60;

/** Under two hours the study time reads to five minutes; above, to the hour, as "about" says. */
const ROUND_TO_HOURS_FROM = 120;
const MINUTES_STEP = 5;

function roundStudyMinutes(minutes: number): number {
  return minutes >= ROUND_TO_HOURS_FROM
    ? Math.round(minutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR
    : Math.round(minutes / MINUTES_STEP) * MINUTES_STEP;
}

/**
 * The plan's one next step, with its ⏎ hint: Enter starts day 1 from anywhere on the screen.
 * Today isn't prefetched as the screen opens: opening it builds the day once, while this screen
 * can still change the plan ("Adjust", "Use 1 hr 40 min a day"). It's prefetched once the learner
 * reaches for it (the pointer on it, a press, the keyboard's focus), when the plan is final, so
 * Today paints from that copy.
 */
function StartButton({ href }: { href: string }) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLAnchorElement>();
  const [reached, setReached] = useState(false);
  const reach = () => setReached(true);

  return (
    <span className="contents" onFocus={reach} onPointerDown={reach} onPointerEnter={reach}>
      <LearnLink
        aria-keyshortcuts="Enter"
        className={cn(DETAIL_PRIMARY_CLASS, "font-[560]")}
        href={href}
        prefetch={reached}
        ref={ref}
      >
        {t("Start")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </LearnLink>
    </span>
  );
}

/**
 * The plan's study time, from the plan's own numbers (the same the course's page and the time
 * question read): what it studies before the date, or all of it without one. Null until the plan
 * says.
 */
function getStudyMinutes(numbers: PlanNumbers | null): number | null {
  if (!numbers) {
    return null;
  }

  return numbers.context.targetDate === null
    ? numbers.scheduledMinutes
    : numbers.beforeDeadlineMinutes;
}

/**
 * The plan's shape in one quiet line, its numbers in the mono face: how long until the goal (or
 * when it ends at this pace), the time a day and the study time it adds up to.
 */
function RevealFacts() {
  const t = useExtracted();
  const today = useMountTime();
  const formatDuration = useFormatDuration();
  const planEnd = usePlanEndText();
  const { plan } = usePlanScreen();
  const { dailyMinutes, targetDate, targetDateEstimated } = plan.schedule;
  const days = targetDate ? daysUntilIsoDate({ isoDate: targetDate, today }) : null;
  const studyMinutes = getStudyMinutes(plan.numbers);
  const studyTime = studyMinutes === null ? 0 : roundStudyMinutes(studyMinutes);

  const facts = [
    days !== null &&
      (targetDateEstimated
        ? t("{days, plural, one {About # day} other {About # days}}", { days })
        : t("{days, plural, one {# day} other {# days}}", { days })),
    days === null && planEnd,
    t("{time} a day", { time: formatDuration(dailyMinutes) }),
    studyTime > 0 && t("about {time} of study", { time: formatDuration(studyTime) }),
  ].filter((fact): fact is string => typeof fact === "string" && fact !== "");

  return (
    <p className="text-muted-foreground font-mono text-[0.8125rem] tabular-nums">
      {facts.map((fact, index) => (
        <Fragment key={fact}>
          {index > 0 && " · "}
          <span>{fact}</span>
        </Fragment>
      ))}
    </p>
  );
}

/**
 * A block of the reveal's aside from 72rem (what fits, the choices), under its label there; under
 * 72rem it follows the weights unlabeled, as one more line of the plan. Each block says nothing
 * when there's nothing to say, and then its label goes too.
 */
function RevealRailBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col gap-2 not-has-[>:nth-child(2)]:hidden">
      <SectionLabel className="hidden min-[72rem]:block">{title}</SectionLabel>
      {children}
    </div>
  );
}

/**
 * The reveal as the plan's page, a detail page's layout: "Plan created" over the goal and its
 * facts, with Start (Enter) and Adjust beside them from `md` and under them on a phone, where
 * Today's and a subject's main action sit; then the phases (a one-phase plan's chapters) and the
 * weights. What fits and the choices sit in the page's aside from 72rem and follow the weights
 * under it.
 */
export function RevealBody({
  isGuest,
  signUpHref,
  syllabus,
  todayHref,
}: {
  isGuest: boolean;
  signUpHref: string;
  syllabus: SyllabusView | null;
  todayHref: string;
}) {
  const t = useExtracted();
  const [editing, setEditing] = useState(false);
  const { goal, plan } = usePlanScreen();

  return (
    <OnboardingColumn
      className="gap-8"
      rail={
        <>
          <RevealRailBlock title={t("What fits")}>
            <RevealCoverage syllabus={syllabus} />
          </RevealRailBlock>

          <RevealRailBlock title={t("Choices")}>
            <PlanChoices />
          </RevealRailBlock>
        </>
      }
      wide
    >
      <DetailHero>
        <DetailHeroText>
          <SuccessEyebrow>{t("Plan created")}</SuccessEyebrow>
          <OnboardingTitle className="text-balance">{goal.title}</OnboardingTitle>
          <RevealFacts />
          <RevealNoticeDay />
        </DetailHeroText>

        <div className="flex flex-col gap-2 md:max-w-xs">
          <DetailActions>
            <StartButton href={todayHref} />
            <Button onClick={() => setEditing(true)} size="lg" variant="outline">
              {t("Adjust")}
            </Button>
          </DetailActions>
          {isGuest && <SavePlanNote signUpHref={signUpHref} />}
        </div>
      </DetailHero>

      <div className="flex flex-col gap-2">
        <PlanPhasesBar />
        <PlanChapterList />
        {plan.notice === "usual" && <UsualStructureNote />}
      </div>

      <AreaWeights syllabus={syllabus} />

      <PlanEditor onOpenChange={setEditing} open={editing} />
    </OnboardingColumn>
  );
}
