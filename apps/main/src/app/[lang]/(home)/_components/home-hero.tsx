import { HERO_CLASS, HERO_LEAD_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { BriefcaseBusinessIcon, GraduationCapIcon, type LucideIcon, PlaneIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { GoalBox } from "./goal-box";
import { HERO_GOAL_ID } from "./home-ids";
import { HomeResume } from "./home-resume";
import { PlanPreview } from "./plan-preview";

/**
 * One outcome's line of the headline. The icon has a column of its own, so words that wrap stay
 * beside it instead of falling under it. The icon sits on the first line's baseline and reaches
 * the ascenders, like a letter, so the three outcomes line up.
 */
function HeadlineOutcome({
  children,
  icon: Icon,
  iconClassName,
}: {
  children: ReactNode;
  icon: LucideIcon;
  iconClassName: string;
}) {
  return (
    <span className="grid grid-cols-[auto_minmax(0,1fr)]">
      <span aria-hidden="true">
        <span
          className={cn(
            "mr-[0.2em] ml-[0.035em] inline-flex size-[0.72em] items-center justify-center rounded-[0.2em] align-baseline",
            iconClassName,
          )}
        >
          <Icon className="size-[0.42em]" strokeWidth={2.2} />
        </span>
      </span>
      <span>{children}</span>
    </span>
  );
}

/**
 * The first screen: what people get ready for and the box for their own goal. Beside it (below on
 * phones) the example goal as a plan.
 */
export async function HomeHero({ startPath }: { startPath: string }) {
  const t = await getExtracted();

  return (
    <section aria-labelledby="home-title" className={HERO_CLASS}>
      <div className="min-w-0 lg:pt-2">
        {/*
          Each line is a block; the spaces between them keep the heading's name a sentence. Beside
          the plan card the column is narrower, so the type steps down there (lg) and back up once
          the column is at its widest (xl), sized so each line stays whole in every language.
        */}
        <h1
          className="ml-[-0.04em] text-[40px] leading-[1.06] font-bold tracking-[-0.04em] text-balance sm:text-[56px] sm:leading-[1.04] lg:text-[52px] xl:text-[64px]"
          id="home-title"
        >
          <span className="block">
            {t({
              description:
                "Home page headline, line 1 of 4. The four lines read as one sentence: 'Get ready for / the exam, / the new job, / the move.' Each line is translated on its own, so make the four fit together.",
              message: "Get ready for",
            })}
          </span>{" "}
          <HeadlineOutcome
            icon={GraduationCapIcon}
            iconClassName="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          >
            {t({
              description:
                "Home page headline, line 2 of 4 ('Get ready for / the exam, / the new job, / the move.'): an exam the reader is preparing for. Use the same kind of article for all three items, and end the line with the punctuation it takes in your sentence.",
              message: "the exam,",
            })}
          </HeadlineOutcome>{" "}
          <HeadlineOutcome
            icon={BriefcaseBusinessIcon}
            iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          >
            {t({
              description:
                "Home page headline, line 3 of 4 ('Get ready for / the exam, / the new job, / the move.'): a new job the reader is starting. Use the same kind of article for all three items. End with a comma only if your sentence has one here: none when the next line starts with a word like 'or'.",
              message: "the new job,",
            })}
          </HeadlineOutcome>{" "}
          <HeadlineOutcome
            icon={PlaneIcon}
            iconClassName="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          >
            {t({
              description:
                "Home page headline, line 4 of 4 ('Get ready for / the exam, / the new job, / the move.'): a move to another city or country. Use the same kind of article for all three items. If your language needs a word like 'or' before the last item of a list, start this line with it. End with a period.",
              message: "the move.",
            })}
          </HeadlineOutcome>
        </h1>

        <p className={HERO_LEAD_CLASS}>
          {t("Tell us your goal. Zoonk plans every day until your date, in the minutes you have.")}
        </p>

        <div className="mt-6 max-w-[560px] sm:mt-8">
          {/* Only someone who already started has something to continue: the page stays static. */}
          <Suspense fallback={null}>
            <HomeResume />
          </Suspense>

          <GoalBox action={startPath} id={HERO_GOAL_ID} variant="card" />

          <p className="text-muted-foreground mt-3 text-center text-[13px] sm:text-sm">
            {t("Free to start. No account needed.")}
          </p>
        </div>
      </div>

      <PlanPreview className="lg:mt-3" />
    </section>
  );
}
