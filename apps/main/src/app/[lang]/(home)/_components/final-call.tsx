import { EYEBROW_CLASS, PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { FINAL_GOAL_ID } from "./home-ids";
import { LandingGoalBox } from "./landing-goal-box";

const CLOSE_TITLE_ID = "landing-close-title";

/**
 * The page ends where every plan ends, the big day, and where it started: the goal box, its
 * example still the goal the visitor picked, with nothing else to decide.
 */
export async function FinalCall({ startPath }: { startPath: string }) {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby={CLOSE_TITLE_ID}
      className={cn(
        PUBLIC_CONTAINER_CLASS,
        "flex flex-col items-center pt-26 pb-24 text-center lg:pt-38 lg:pb-40",
      )}
    >
      <p className={cn(EYEBROW_CLASS, "flex items-center gap-2.5")}>
        <FlagIcon aria-hidden="true" className="text-foreground size-3.5" />
        {t("The big day")}
      </p>

      <h2
        className="mt-4 max-w-[14em] text-[32px] leading-[1.08] font-semibold tracking-[-0.04em] text-balance lg:text-5xl"
        id={CLOSE_TITLE_ID}
      >
        {t("What's your big day?")}
      </h2>

      <div className="max-w-column mt-7 w-full text-left">
        <LandingGoalBox action={startPath} id={FINAL_GOAL_ID} />
      </div>
    </section>
  );
}
