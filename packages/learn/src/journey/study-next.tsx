"use client";

import { type StudyNextView } from "@zoonk/core/view-models/map/contract";
import { Button } from "@zoonk/ui/components/button";
import { ArrowRightIcon, ChevronRightIcon, LibraryIcon, PartyPopperIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { useLevelName } from "../course/use-level-name";
import { LearnLink } from "../learn-link";

type CourseLink = StudyNextView["related"][number];

/** "Continue at Beginner": one tap starts the next level; the host opens the new plan. */
function ContinueAtNextLevel({
  next,
  onContinue,
}: {
  next: NonNullable<StudyNextView["nextLevel"]>;
  onContinue: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const levelName = useLevelName();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const start = () => {
    startTransition(async () => {
      setFailed(!(await onContinue()));
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button className="h-11 w-full" disabled={isPending} onClick={start}>
        {t("Continue at {level}", { level: levelName(next.level) })}
        <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        {t("{course} · {level}", { course: next.title, level: levelName(next.level) })}
      </p>
      {failed && (
        <p className="text-destructive text-center text-sm" role="status">
          {t("That didn't work. Try again in a moment.")}
        </p>
      )}
    </div>
  );
}

function RelatedCourses({
  courseHref,
  related,
}: {
  courseHref: (course: CourseLink) => string;
  related: CourseLink[];
}) {
  const t = useExtracted();

  if (related.length === 0) {
    return null;
  }

  return (
    <nav aria-label={t("Related courses")} className="flex flex-col">
      {related.map((course) => (
        <LearnLink
          className="hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm font-medium outline-none focus-visible:ring-[3px]"
          href={courseHref(course)}
          key={course.courseId}
        >
          <LibraryIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 flex-1">{course.title}</span>
          <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        </LearnLink>
      ))}
    </nav>
  );
}

/**
 * Once every lesson is done, the path's finish: say so, and what to study next. The next level of
 * the same course is one tap; the other courses the plan drew from are a link each.
 */
export function StudyNext({
  courseHref,
  next,
  onContinue,
}: {
  courseHref: (course: CourseLink) => string;
  next: StudyNextView;
  onContinue: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const hasNext = next.nextLevel !== null || next.related.length > 0;

  return (
    <section
      aria-labelledby="study-next-title"
      className="bg-muted/60 motion-safe:animate-in motion-safe:fade-in flex flex-col gap-4 rounded-3xl p-5"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-success/15 text-success flex size-11 shrink-0 items-center justify-center rounded-xl"
        >
          <PartyPopperIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="font-semibold" id="study-next-title">
            {t("You finished your plan")}
          </h2>
          {hasNext && (
            <p className="text-muted-foreground text-sm">{t("Here's what to study next.")}</p>
          )}
        </div>
      </div>

      {next.nextLevel && <ContinueAtNextLevel next={next.nextLevel} onContinue={onContinue} />}
      <RelatedCourses courseHref={courseHref} related={next.related} />
    </section>
  );
}
