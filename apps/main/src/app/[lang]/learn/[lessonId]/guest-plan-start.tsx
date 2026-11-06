"use client";

import { CourseStartFailureNote } from "@/components/public/course-start-failure";
import { useCourseStart } from "@/components/public/use-course-start";
import { Link } from "@/i18n/navigation";
import { getGoalStartHref } from "@/lib/public/public-hrefs";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

type CourseStart = { chapterId: string | null; courseId: string };

const PLAN_CLASS = cn(buttonVariants({ size: "xl" }), "w-full");

function StartCoursePlan({ start }: { start: CourseStart }) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLButtonElement>();
  const { failure, pending, start: startCourse } = useCourseStart(start);

  return (
    <>
      <Button
        aria-keyshortcuts="Enter"
        busy={pending}
        className="w-full"
        onClick={startCourse}
        ref={ref}
        size="xl"
      >
        {t("Build my plan")}
        <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
      </Button>

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
  const ref = useEnterClick<HTMLAnchorElement>();

  if (start) {
    return <StartCoursePlan start={start} />;
  }

  return (
    <Link aria-keyshortcuts="Enter" className={PLAN_CLASS} href={getGoalStartHref(goal)} ref={ref}>
      {t("Build my plan")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </Link>
  );
}
