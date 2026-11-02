import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { FINAL_GOAL_ID } from "./home-ids";
import { LandingGoalBox } from "./landing-goal-box";

const TITLE_ID = "final-call-title";

export async function FinalCall({ startPath }: { startPath: string }) {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby={TITLE_ID}
      className="bg-background text-foreground dark:border-y"
      data-slot="ink-band"
    >
      <div className={cn(PUBLIC_CONTAINER_CLASS, "flex flex-col items-center py-26 text-center")}>
        <h2
          className="text-[clamp(2.5rem,6.6vw,5.5rem)] leading-[0.98] font-[680] tracking-[-0.052em] text-balance"
          id={TITLE_ID}
        >
          {t("Start with what matters today.")}
        </h2>
        <p className="text-muted-foreground mt-4.5 max-w-[30em] text-[1.0625rem] leading-normal text-pretty lg:text-xl">
          {t({
            description:
              "In Brazilian Portuguese: “Conte sua meta e responda umas perguntas rápidas. Depois, é só seguir o plano de cada dia.”",
            message:
              "Tell us your goal and answer a few quick questions. Then just follow each day's plan.",
          })}
        </p>

        <div className="max-w-column mt-8 w-full text-left">
          <LandingGoalBox
            action={startPath}
            id={FINAL_GOAL_ID}
            note={t("Start free, no account needed.")}
          />
        </div>
      </div>
    </section>
  );
}
