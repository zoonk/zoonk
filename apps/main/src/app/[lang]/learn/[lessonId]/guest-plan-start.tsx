"use client";

import { CourseStartFailureNote } from "@/components/public/course-start-failure";
import { useCourseStart } from "@/components/public/use-course-start";
import { Link } from "@/i18n/navigation";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { EnterButton, EnterLink } from "@zoonk/learn/enter-button";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

type CourseStart = { chapterId: string | null; courseId: string };

function StartCoursePlan({ start }: { start: CourseStart }) {
  const t = useExtracted();
  const { failure, pending, start: startCourse } = useCourseStart(start);

  return (
    <>
      <EnterButton busy={pending} className="w-full" onClick={startCourse}>
        {t("Build my plan")}
      </EnterButton>

      {pending && (
        <span className="sr-only" role="status">
          {t("Starting your plan…")}
        </span>
      )}

      <CourseStartFailureNote
        actionClassName={cn(buttonVariants({ size: "xl", variant: "outline" }), "w-full")}
        className="max-w-none items-stretch text-center"
        failure={failure}
        onRetry={startCourse}
      />
    </>
  );
}

export function GuestPlanStart({ goal, start }: { goal: string; start: CourseStart | null }) {
  const t = useExtracted();

  if (start) {
    return <StartCoursePlan start={start} />;
  }

  return (
    <EnterLink className="w-full" href={getGoalStartHref(goal)} link={Link}>
      {t("Build my plan")}
    </EnterLink>
  );
}
