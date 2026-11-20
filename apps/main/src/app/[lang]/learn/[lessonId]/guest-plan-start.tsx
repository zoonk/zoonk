"use client";

import { CourseStartFailureNote } from "@/components/public/course-start-failure";
import { useCourseStart } from "@/components/public/use-course-start";
import { Link } from "@/i18n/navigation";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { EnterButton, EnterLink } from "@zoonk/learn/enter-button";
import { TaskActionBar, TaskActions } from "@zoonk/learn/task-layout";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";

type CourseStart = { chapterId: string | null; courseId: string };

function StartCoursePlan({ other, start }: { other: ReactNode; start: CourseStart }) {
  const t = useExtracted();
  const { failure, pending, start: startCourse } = useCourseStart(start);

  return (
    <TaskActionBar
      note={
        failure && (
          <CourseStartFailureNote
            actionClassName={buttonVariants({ size: "sm", variant: "outline" })}
            failure={failure}
            onRetry={startCourse}
            secondaryActionClassName={buttonVariants({ size: "sm", variant: "outline" })}
          />
        )
      }
    >
      <TaskActions>
        {other}
        <EnterButton busy={pending} onClick={startCourse}>
          {t("Build my plan")}
        </EnterButton>
      </TaskActions>

      {pending && (
        <span className="sr-only" role="status">
          {t("Starting your plan…")}
        </span>
      )}
    </TaskActionBar>
  );
}

/** A visitor's lesson end: `other`, then "Build my plan", in the screen's bar. */
export function GuestPlanStart({
  goal,
  other,
  start,
}: {
  goal: string;
  other: ReactNode;
  start: CourseStart | null;
}) {
  const t = useExtracted();

  if (start) {
    return <StartCoursePlan other={other} start={start} />;
  }

  return (
    <TaskActionBar>
      <TaskActions>
        {other}
        <EnterLink href={getGoalStartHref(goal)} link={Link}>
          {t("Build my plan")}
        </EnterLink>
      </TaskActions>
    </TaskActionBar>
  );
}
