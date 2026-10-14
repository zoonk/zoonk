import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { PlanRoad, type RoadBand } from "@/components/public/plan-road";
import { ProductWindow } from "@/components/public/product-window";
import {
  Stop,
  StopBody,
  StopEyebrow,
  StopHeader,
  StopLead,
  StopMark,
  StopTitle,
} from "@/components/public/stop";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { KindDot } from "@zoonk/learn/kind-tile";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

const COVERS_TITLE_ID = "pricing-covers";

/** A month's weekdays, which the free plan's lessons a month spread over. */
const WEEKDAYS_A_MONTH = 20;

const DAYS_PER_WEEK = 7;

/** Days of room the free band gets past its own, so "Diagnostic and week 1" fits. */
const FREE_BAND_ROOM = 5;

/**
 * The example plan's Plus phases in proportion: closing gaps, then practice, then a week's final
 * review. Named by what they're for, not by week numbers, since a real plan's length follows the
 * learner's exam date.
 */
const GAPS_WEEKS = 3;
const PRACTICE_WEEKS = 5;

/** Where the example's mock exams fall within their phase, as shares of its length. */
const PRACTICE_FIRST_MOCK_SHARE = 0.35;
const PRACTICE_SECOND_MOCK_SHARE = 0.8;
const FINAL_MOCK_SHARE = 0.4;

/** The legend's swatch for what the free plan covers and what only Plus does, as the road draws them. */
const SWATCH_CLASS = "inline-block h-2.5 w-3.5 rounded-[3px] ring-1 ring-inset";

/**
 * An exam plan on the Plan's road, its phases by what they're for: the diagnostic and the first
 * week free (as raised as the Plan's current phase, today at its start), the weeks after it Plus
 * (hatched), mock exams on their days and the exam's flag at the end.
 */
async function getExamRoad(): Promise<RoadBand[]> {
  const t = await getExtracted();
  const freeDays = getFreePlanLimits().examPrepDays ?? DAYS_PER_WEEK;

  return [
    {
      id: "free",
      name: t(
        "{days, plural, =7 {Diagnostic and week 1} one {Diagnostic and day 1} other {Diagnostic and the first # days}}",
        { days: freeDays },
      ),
      state: "current",
      todayShare: 0,
      // A little wider than its days, so its name reads whole: the bands after it say their weeks.
      weight: freeDays + FREE_BAND_ROOM,
    },
    { id: "gaps", name: t("Closing gaps"), state: "plus", weight: GAPS_WEEKS * DAYS_PER_WEEK },
    {
      id: "practice",
      mocks: [PRACTICE_FIRST_MOCK_SHARE, PRACTICE_SECOND_MOCK_SHARE],
      name: t("Practice"),
      state: "plus",
      weight: PRACTICE_WEEKS * DAYS_PER_WEEK,
    },
    {
      id: "final",
      mocks: [FINAL_MOCK_SHARE],
      name: t("Final review"),
      state: "plus",
      weight: DAYS_PER_WEEK,
    },
  ];
}

/** The example exam plan's road under its legend: what's free, what's Plus and where mocks fall. */
async function ExamPlanRoad() {
  const t = await getExtracted();
  const bands = await getExamRoad();
  const freeDays = getFreePlanLimits().examPrepDays ?? DAYS_PER_WEEK;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="text-sm font-semibold">{t("An exam plan")}</p>

        {/* The legend names the full road's marks; the phone's bar says them in words instead. */}
        <p
          aria-hidden="true"
          className="text-muted-foreground hidden flex-wrap gap-x-4 gap-y-1.5 text-xs lg:flex"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className={cn(SWATCH_CLASS, "bg-surface-3 ring-input")} />
            {t("Free")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                SWATCH_CLASS,
                "ring-border bg-[repeating-linear-gradient(135deg,transparent_0_3px,color-mix(in_oklab,var(--faint)_32%,transparent)_3px_4px)]",
              )}
            />
            {t("Plus")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <KindDot kind="mock" />
            {t("Mock exam")}
          </span>
        </p>
      </div>

      <PlanRoad
        bands={bands}
        caption={t(
          "{days, plural, =7 {Free: the diagnostic and week 1 · Plus: every week after it to exam day, with mock exams} one {Free: the diagnostic and day 1 · Plus: every day after it to exam day, with mock exams} other {Free: the diagnostic and the first # days · Plus: every day after them to exam day, with mock exams}}",
          { days: freeDays },
        )}
        end={t("Exam day")}
        fullFrom="lg"
        todayLabel={t("Today")}
      />
    </div>
  );
}

/**
 * Any other goal's free month: its lessons a month and a day, and what that comes to each weekday
 * when the month's allowance spreads over them.
 */
async function FreeMonth() {
  const t = await getExtracted();
  const limits = getFreePlanLimits();
  const perMonth = limits.lessonsPerMonth ?? 0;
  const perWeekday = Math.max(1, Math.round(perMonth / WEEKDAYS_A_MONTH));

  return (
    <div className="flex flex-col gap-3 border-t pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold">{t("Any other goal")}</p>
        <p className="text-muted-foreground text-xs">
          {t(
            "{month, plural, one {# lesson} other {# lessons}} a month, up to {day, number} a day",
            { day: limits.lessonsPerDay ?? 0, month: perMonth },
          )}
        </p>
      </div>

      <p className="text-muted-foreground text-[0.8125rem]">
        {t(
          "{count, plural, one {About one short lesson each weekday.} other {About # short lessons each weekday.}}",
          { count: perWeekday },
        )}
      </p>
    </div>
  );
}

/**
 * What the free plan covers, on the plan's own road: an exam plan's diagnostic and first week free,
 * the rest Plus with its mock exams; then any other goal's month and its lessons a weekday. Every
 * number comes from the rules the allowance enforces.
 */
export async function PricingCovers() {
  const t = await getExtracted();

  return (
    <div className={PUBLIC_CONTAINER_CLASS}>
      <Stop aria-labelledby={COVERS_TITLE_ID} className="pt-24 lg:pt-32">
        <StopHeader>
          <StopEyebrow>
            <StopMark>
              <FlagIcon className="size-3.5" />
            </StopMark>
            {t("What free covers")}
          </StopEyebrow>

          <StopTitle id={COVERS_TITLE_ID}>{t("See your whole plan before you pay.")}</StopTitle>

          <StopLead>
            {t(
              "For an exam, the diagnostic, your plan and its first week are free. Plus keeps you going to exam day, with mock exams along the way.",
            )}
          </StopLead>
        </StopHeader>

        <StopBody>
          <ProductWindow className="flex flex-col gap-7 p-5 sm:px-8 sm:py-7">
            <ExamPlanRoad />

            <FreeMonth />
          </ProductWindow>
        </StopBody>
      </Stop>
    </div>
  );
}
