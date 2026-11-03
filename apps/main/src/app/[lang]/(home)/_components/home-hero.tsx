import { NUMERIC_CLASS, PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import { getAppLocale } from "@/i18n/locale";
import { DaySegment } from "@zoonk/learn/day-segments";
import { MeterParts } from "@zoonk/learn/meter";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { ExampleCardHead, ExampleDay, getExampleDailyTime } from "./example-card";
import { toExampleSteps } from "./example-steps";
import { getHomeHeadline } from "./home-headline";
import { HERO_GOAL_ID } from "./home-ids";
import { getExampleSet } from "./landing-examples";
import { LandingGoalBox } from "./landing-goal-box";

const TITLE_ID = "home-title";

const PHASES = [
  { id: "foundations", weight: 3 },
  { id: "gaps", weight: 4 },
  { id: "practice", weight: 4 },
  { id: "finalStretch", weight: 2 },
];

const PLAN_DAY = 3;

function renderLine(chunks: React.ReactNode) {
  return <span className="block text-balance">{chunks}</span>;
}

function renderMore(chunks: React.ReactNode) {
  return <span className="text-muted-foreground block text-balance">{chunks}</span>;
}

async function ExamPlan() {
  const t = await getExtracted();
  const tPhases = await getExtracted("planPhases");
  const { exam } = await getExampleSet();
  const steps = toExampleSteps(exam.day);
  const minutes = steps.reduce((sum, step) => sum + step.minutes, 0);

  return (
    <ProductWindow className="mt-18 lg:mt-0 lg:shadow-[0_24px_60px_-28px_oklch(0_0_0/22%)] dark:lg:shadow-[0_24px_60px_-28px_oklch(0_0_0/70%)]">
      <div className="px-5 pt-5 pb-4">
        <ExampleCardHead detail={await getExampleDailyTime(minutes)} title={exam.headline} />

        <MeterParts className="mt-4">
          {PHASES.map((phase, index) => (
            <DaySegment
              key={phase.id}
              minutes={phase.weight}
              state={index === 0 ? "current" : "ahead"}
            />
          ))}
        </MeterParts>

        <p className="mt-2 flex justify-between gap-3 text-xs">
          <span>
            <b className="font-[550]">{tPhases("Foundations")}</b>
            <span className="text-muted-foreground">
              {` · ${t("day {number, number}", { number: PLAN_DAY })}`}
            </span>
          </span>
          <span className={cn(NUMERIC_CLASS, "text-muted-foreground")}>
            {t({
              description:
                "Which of the example plan's phases it's in, under a meter of its phases.",
              message: "{number, number} of {total, number}",
              values: { number: 1, total: PHASES.length },
            })}
          </span>
        </p>
      </div>

      <div className="border-t px-5 pt-4 pb-1.5">
        <ExampleDay steps={steps} />
      </div>
    </ProductWindow>
  );
}

export async function HomeHero({ startPath }: { startPath: string }) {
  const t = await getExtracted();
  const locale = await getAppLocale();

  return (
    <section
      aria-labelledby={TITLE_ID}
      className={cn(
        PUBLIC_CONTAINER_CLASS,
        "pt-3 pb-26 sm:pt-8 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16 lg:pt-14 lg:pb-38 xl:grid-cols-[minmax(0,1fr)_26rem]",
      )}
    >
      <div className="@container min-w-0">
        <h1
          className="text-[min(10.6cqi,5.25rem)] leading-none font-[680] tracking-[-0.045em] lg:leading-[0.98]"
          id={TITLE_ID}
        >
          {await getHomeHeadline({ line: renderLine, locale, more: renderMore })}
        </h1>

        <p className="text-lead mt-5 max-w-[31em] lg:mt-7 lg:text-xl lg:leading-[1.85rem]">
          {t({
            description:
              "The landing's subhead, under a headline listing goals. In Brazilian Portuguese: “Conte seu objetivo e a data. O Zoonk monta um plano para cada dia, do tamanho do seu tempo, começando pelo que você já sabe.”",
            message:
              "Tell Zoonk your goal and the date. It builds a plan for each day that fits your time and starts from what you already know.",
          })}
        </p>

        <div className="mt-7 max-w-148 lg:mt-9">
          <LandingGoalBox action={startPath} example="exam" id={HERO_GOAL_ID} />
        </div>
      </div>

      <ExamPlan />
    </section>
  );
}
