import {
  DISPLAY_CLASS,
  LEAD_CLASS,
  PUBLIC_CONTAINER_CLASS,
} from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { HeroWindow } from "./hero-window";
import { HERO_GOAL_ID } from "./home-ids";
import { LandingGoalBox } from "./landing-goal-box";

/**
 * The first screen: the promise, how Zoonk keeps it in one line and the one box for the visitor's
 * own goal, then the product keeping it at the page's full width: the example goals beside the
 * plan of the one picked, which the rest of the page follows.
 */
export async function HomeHero({ startPath }: { startPath: string }) {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby="home-title"
      className={cn(PUBLIC_CONTAINER_CLASS, "flex flex-col pt-10 sm:pt-14 lg:pt-22")}
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

      <HeroWindow className="mt-14 lg:mt-18" />
    </section>
  );
}
