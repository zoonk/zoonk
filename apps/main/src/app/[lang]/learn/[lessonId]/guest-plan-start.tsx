"use client";

import { CourseStartFailureNote } from "@/components/public/course-start-failure";
import { useCourseStart } from "@/components/public/use-course-start";
import { Link } from "@/i18n/navigation";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { usePrimaryVariant } from "@zoonk/learn/fun-primary";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";

type CourseStart = { chapterId: string | null; courseId: string };

function usePlanClassName() {
  const primaryVariant = usePrimaryVariant();

  return cn(
    buttonVariants({ size: "lg", variant: primaryVariant }),
    "h-12 w-full rounded-full text-base",
  );
}

/** Starts the lesson's course as the guest's goal right here: no goal to type or confirm. */
function StartCoursePlan({ start }: { start: CourseStart }) {
  const t = useExtracted();
  const className = usePlanClassName();
  const ref = useEnterClick<HTMLButtonElement>();
  const { failure, pending, start: startCourse } = useCourseStart(start);

  return (
    <>
      <button
        className={className}
        disabled={pending}
        onClick={startCourse}
        ref={ref}
        type="button"
      >
        {t("Build my plan")}
        {pending && <Loader2Icon aria-hidden="true" className="animate-spin" />}
      </button>

      {pending && (
        <span className="sr-only" role="status">
          {t("Starting your plan…")}
        </span>
      )}

      <CourseStartFailureNote
        actionClassName={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          "in-data-[mode=fun]:fun-glass h-12 w-full rounded-full text-base",
        )}
        className="max-w-none items-stretch text-center"
        failure={failure}
        onRetry={startCourse}
      />
    </>
  );
}

/**
 * "Build my plan" after a guest's lesson: the lesson's course becomes their goal on the tap, from
 * the lesson's chapter when that's where they began (see `LessonFit`). A lesson outside any
 * public course opens onboarding with its subject filled in instead.
 */
export function GuestPlanStart({ goal, start }: { goal: string; start: CourseStart | null }) {
  const t = useExtracted();
  const className = usePlanClassName();
  const ref = useEnterClick<HTMLAnchorElement>();

  if (start) {
    return <StartCoursePlan start={start} />;
  }

  return (
    <Link className={className} href={getGoalStartHref(goal)} ref={ref}>
      {t("Build my plan")}
    </Link>
  );
}
