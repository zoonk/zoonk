import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { VariantSwitch, VariantSwitchOption } from "@/components/public/variant-switch";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { HeroStage } from "./hero-stage";
import { HERO_GOAL_ID } from "./home-ids";
import {
  DEFAULT_EXAMPLE_GOAL,
  EXAMPLE_GOALS,
  type ExampleGoal,
  GOAL_SWITCH,
  getExampleSet,
} from "./landing-examples";
import { LandingGoalBox } from "./landing-goal-box";

const GOAL_CHIP_CLASS = cn(
  "ring-input hover:bg-muted inline-flex min-h-11 min-w-0 items-center justify-center rounded-[0.625rem] px-1 text-[0.90625rem] font-medium whitespace-nowrap ring-1 transition-colors ring-inset sm:px-4 sm:text-[0.9375rem]",
  "has-checked:bg-selected-tint has-checked:ring-selected has-checked:ring-2",
  "has-focus-visible:outline-ring has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
);

function renderLine(chunks: React.ReactNode) {
  return <span className="block text-balance">{chunks}</span>;
}

async function GoalChips() {
  const t = await getExtracted();
  const set = await getExampleSet();

  const labels: Record<ExampleGoal, string> = {
    exam: set.exam.name,
    job: t({
      description: "A chip naming a career change as an example goal: one short word.",
      message: "Career",
    }),
    move: set.move === "mexico-city" ? t("Spanish") : t("English"),
  };

  return (
    <VariantSwitch
      aria-label={t("Example goals")}
      className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap"
      defaultValue={DEFAULT_EXAMPLE_GOAL}
      name={GOAL_SWITCH}
      values={EXAMPLE_GOALS}
    >
      {EXAMPLE_GOALS.map((goal) => (
        <VariantSwitchOption
          className={GOAL_CHIP_CLASS}
          defaultValue={DEFAULT_EXAMPLE_GOAL}
          key={goal}
          name={GOAL_SWITCH}
          value={goal}
        >
          {labels[goal]}
        </VariantSwitchOption>
      ))}
    </VariantSwitch>
  );
}

export async function HomeHero({ startPath }: { startPath: string }) {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby="home-title"
      className={cn(
        PUBLIC_CONTAINER_CLASS,
        "grid grid-cols-1 gap-6 pt-2 pb-16 sm:pt-6 lg:grid-cols-2 lg:gap-12 lg:pt-9 lg:pb-24 xl:grid-cols-[minmax(0,35.5rem)_minmax(0,1fr)] xl:gap-16",
      )}
    >
      <div className="flex min-w-0 flex-col lg:self-center">
        <h1
          className="text-[clamp(2.5rem,10.4vw,4.5rem)] leading-[0.98] font-[680] tracking-tighter lg:text-[clamp(3.75rem,5.3vw,4.875rem)]"
          id="home-title"
        >
          {t.rich({
            description:
              "The landing's headline: two short sentences, each shown as its own line. Keep it short and punchy. In Brazilian Portuguese: “Pare de decidir o que estudar. Só estude.”",
            message: "<line>Stop deciding what to study.</line> <line>Just study.</line>",
            values: { line: renderLine },
          })}
        </h1>

        <p className="text-lead mt-3 max-w-[31em] lg:mt-5 lg:text-xl lg:leading-normal">
          {t({
            description:
              "The landing's subhead. In Brazilian Portuguese: “Conte sua meta e a data. O Zoonk divide tudo em um plano diário do tamanho do seu tempo.”",
            message:
              "Tell us your goal and the date. Zoonk splits it all into a daily plan sized to your time.",
          })}
        </p>

        <div className="mt-5 flex flex-col gap-3 lg:mt-8">
          <LandingGoalBox action={startPath} fillsFromChips id={HERO_GOAL_ID} />
          <GoalChips />
          <p className="text-muted-foreground text-sm">{t("Start free, no account needed.")}</p>
        </div>
      </div>

      <HeroStage />
    </section>
  );
}
