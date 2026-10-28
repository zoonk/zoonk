"use client";

import { useExtracted } from "next-intl";
import { useFormatDuration } from "../../_utils/time-format";
import { type ExamFinish } from "../../plan/plan-full-course";
import { FullCourseToggle } from "./full-course-toggle";

export const FULL_COURSE_ID = "onboarding-full-course";

export function getShownShare(estimate: { failed: boolean; share: number | null }): number | null {
  return estimate.failed ? null : estimate.share;
}

function isShort(share: number | null): boolean {
  return share !== null && share < 1;
}

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
  fullCourseEnd: ExamFinish | null;
  minutes: number;
  onFullCourseChange: (checked: boolean) => void;
  share: number | null;
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
