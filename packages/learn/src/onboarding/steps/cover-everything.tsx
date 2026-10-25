"use client";

import { useExtracted } from "next-intl";
import { useFormatDuration } from "../../_utils/time-format";
import { type ExamFinish } from "../../plan/plan-full-course";
import { FullCourseToggle } from "./full-course-toggle";

/** An exam's "Study everything" switch: where Find sends the keyboard once no time covers it all. */
export const FULL_COURSE_ID = "onboarding-full-course";

/**
 * What the estimate on screen says the time covers (the last share, while another time is asked
 * about), so what follows it never disagrees with it; nothing once asking for it stopped.
 */
export function getShownShare(estimate: { failed: boolean; share: number | null }): number | null {
  return estimate.failed ? null : estimate.share;
}

/** The time picked leaves something out by the date, as far as the estimate on screen says. */
function isShort(share: number | null): boolean {
  return share !== null && share < 1;
}

/**
 * After the estimate, what studying everything would take, so nothing is said twice: Find's line
 * (`children`) says the time needed, only while the time picked covers less than everything (or
 * before it's known); then the other way to it, while something is left out: an exam's switch to
 * go on after the exam (where Find sends the keyboard once no time covers it all), which stays
 * while it's on until the time is known to cover everything (`studiesEverything`), or for any
 * other goal, that the next screen moves its date.
 */
export function CoverEverything({
  children,
  exam,
  fullCourse,
  fullCourseEnd,
  minutes,
  onFullCourseChange,
  share,
  studiesEverything,
}: {
  children: React.ReactNode;
  exam: boolean;
  fullCourse: boolean;
  /** When studying everything ends at the time picked, once the plan says it. */
  fullCourseEnd: ExamFinish | null;
  minutes: number;
  onFullCourseChange: (checked: boolean) => void;
  share: number | null;
  /** The learner's choice to study everything goes with the plan (see `keepsFullCourse`). */
  studiesEverything: boolean;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const short = isShort(share);

  return (
    <div className="flex flex-col gap-4 empty:hidden">
      {(share === null || short) && (
        <div className="text-muted-foreground text-sm text-pretty">{children}</div>
      )}

      {exam && (short || studiesEverything) && (
        <FullCourseToggle
          checked={fullCourse}
          end={fullCourseEnd}
          id={FULL_COURSE_ID}
          onCheckedChange={onFullCourseChange}
        />
      )}

      {!exam && short && (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("To cover everything at {time} a day, move your date on the next screen.", {
            time: formatDuration(minutes),
          })}
        </p>
      )}
    </div>
  );
}
