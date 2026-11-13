import { FIRST_SCREEN_TOP_CLASS, PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { getAppLocale } from "@/i18n/locale";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { ExampleDayCard } from "./example-card";
import { toExampleSteps } from "./example-steps";
import { getHomeHeadline } from "./home-headline";
import { getExampleSet } from "./landing-examples";
import { LandingGoalBox } from "./landing-goal-box";

const TITLE_ID = "home-title";

function renderLine(chunks: React.ReactNode) {
  return <span className="block text-balance">{chunks}</span>;
}

function renderMore(chunks: React.ReactNode) {
  return <span className="text-muted-foreground block text-balance">{chunks}</span>;
}

async function ExamPlan() {
  const { exam } = await getExampleSet();

  return (
    <ExampleDayCard
      className="mt-18 lg:mt-0"
      steps={toExampleSteps(exam.day)}
      title={exam.headline}
    />
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
        FIRST_SCREEN_TOP_CLASS.landing,
        "pb-28 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16 lg:pb-37 xl:grid-cols-[minmax(0,1fr)_26rem]",
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
          <LandingGoalBox action={startPath} example="exam" id="goal" />
        </div>
      </div>

      <ExamPlan />
    </section>
  );
}
