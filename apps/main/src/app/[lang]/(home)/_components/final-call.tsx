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
      <div
        className={cn(
          PUBLIC_CONTAINER_CLASS,
          "flex flex-col items-center py-26 text-center lg:py-34",
        )}
      >
        <h2
          className="text-[clamp(2.5rem,7vw,5.25rem)] leading-[0.98] font-[680] tracking-tighter text-balance"
          id={TITLE_ID}
        >
          {t({
            description: "In Brazilian Portuguese: “Qual é o seu objetivo?”",
            message: "What's your goal?",
          })}
        </h2>
        <p className="text-lead mt-4.5 max-w-[28em]">
          {t({
            description:
              "In Brazilian Portuguese: “Conte do seu jeito e responda umas perguntas rápidas. Depois, é só seguir o plano de cada dia.”",
            message:
              "Tell us in your own words and answer a few quick questions. Then just follow each day's plan.",
          })}
        </p>

        <div className="max-w-column mt-9 w-full text-left">
          <LandingGoalBox action={startPath} example="language" id={FINAL_GOAL_ID} />
        </div>
      </div>
    </section>
  );
}
