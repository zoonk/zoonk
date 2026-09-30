"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon, MapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { BuiltFromCourse, isCourseSubset } from "../course/built-from-course";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "./plan-context";

/** "See the map": every skill of the goal, drawn from its skill graph. */
function MapLink({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <LearnLink
      className={cn(
        buttonVariants({ variant: "outline" }),
        "in-data-[mode=fun]:fun-glass w-full justify-start",
      )}
      href={href}
    >
      <MapIcon aria-hidden="true" />
      {t("See the map of your subject")}
    </LearnLink>
  );
}

/**
 * Where the plan comes from and where it can go: the map of the subject, which also shows its
 * levels, and the course it's built from ("14 of 62 chapters · See full course").
 */
export function PlanCourse() {
  const { courseHref, mapHref, plan } = usePlanScreen();
  const { course } = plan;
  const subset = isCourseSubset(course) && courseHref ? { course, courseHref } : null;

  if (!mapHref && !subset) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {mapHref && <MapLink href={mapHref} />}
      {subset && <BuiltFromCourse course={subset.course} courseHref={subset.courseHref} />}
    </div>
  );
}

/**
 * Every lesson of the plan is done: say so, and lead to the map, where the next level waits with
 * one tap.
 */
export function PlanFinished() {
  const t = useExtracted();
  const primaryVariant = usePrimaryVariant();
  const { mapHref, plan } = usePlanScreen();

  if (!plan.finished || !mapHref) {
    return null;
  }

  return (
    <section
      aria-labelledby="plan-finished-title"
      className="bg-muted in-data-[mode=fun]:fun-glass flex flex-col gap-3 rounded-3xl p-4"
    >
      <div className="flex items-center gap-3">
        <FlagIcon aria-hidden="true" className="text-success size-5 shrink-0" />
        <h2 className="font-semibold" id="plan-finished-title">
          {t("You finished this plan")}
        </h2>
      </div>
      <p className="text-muted-foreground text-sm">
        {t("Every lesson is behind you. See your map and what to study next.")}
      </p>
      <LearnLink
        className={cn(buttonVariants({ variant: primaryVariant }), "self-start")}
        href={mapHref}
      >
        {t("What to study next")}
      </LearnLink>
    </section>
  );
}
