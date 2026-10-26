import {
  DISPLAY_CLASS,
  LEAD_CLASS,
  PUBLIC_CONTAINER_CLASS,
} from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { HERO_GOAL_ID } from "./home-ids";
import { LandingGoalBox } from "./landing-goal-box";

/**
 * The first screen's words, on the page: the promise, how Zoonk keeps it in one line and the one
 * box for the visitor's own goal. The product keeping it follows on its own band
 * (`HomeExample`).
 */
export async function HomeHero({ startPath }: { startPath: string }) {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby="home-title"
      className={cn(
        PUBLIC_CONTAINER_CLASS,
        "flex flex-col pt-10 pb-12 sm:pt-14 sm:pb-16 lg:pt-22 lg:pb-20",
      )}
    >
      <h1 className={cn(DISPLAY_CLASS, "max-w-[13.8em]")} id="home-title">
        {t("Know what to study every day until the big day.")}
      </h1>

      <p className={cn(LEAD_CLASS, "mt-4.5 max-w-132 lg:text-[19px]")}>
        {t(
          "Tell Zoonk your goal and date. Your plan fits your schedule and adjusts if you miss a day.",
        )}
      </p>

      <div className="max-w-column mt-7 lg:mt-8">
        <LandingGoalBox action={startPath} id={HERO_GOAL_ID} />
      </div>
    </section>
  );
}
