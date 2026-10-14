import { NoAccountNote } from "@/components/public/no-account-note";
import { StartBlock, getSecondaryStartControlClassName } from "@/components/public/public-start";
import { StartPlanLink } from "@/components/public/start-plan-link";
import { Variant } from "@/components/public/variant-switch";
import { findCourseGoalStart } from "@zoonk/core/goals/start-course";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

/**
 * The example plan's time-a-day switch: its radios' name, the minutes it offers and the one it
 * shows first, which the visitor didn't pick.
 */
export type PaceChoice = { firstShown: number | null; minutes: number[]; name: string };

/**
 * "Build my plan" with the time a day picked on the example plan, so the plan starts with it: a
 * link per pace, the picked one showing. Without the plan's switch, one link. A learner whose goal
 * already follows the course gets "Continue your plan" in its place, read per request; until then,
 * and for everyone else, the plan's links.
 */
function CoursePlanLink({ courseId, pace }: { courseId: string; pace: PaceChoice | null }) {
  const startLinks = <StartPlanLinks courseId={courseId} pace={pace} />;

  return (
    <Suspense fallback={startLinks}>
      <ContinueOrStart courseId={courseId} startLinks={startLinks} />
    </Suspense>
  );
}

/**
 * A learner already studying this course: the start page sends them back to their goal, so the
 * link says that instead of offering a new plan.
 */
async function ContinueOrStart({
  courseId,
  startLinks,
}: {
  courseId: string;
  startLinks: React.ReactNode;
}) {
  const existing = await findCourseGoalStart(courseId);
  return existing ? <StartPlanLink continues courseId={courseId} /> : startLinks;
}

function StartPlanLinks({ courseId, pace }: { courseId: string; pace: PaceChoice | null }) {
  if (!pace) {
    return <StartPlanLink courseId={courseId} />;
  }

  return pace.minutes.map((minutes) => (
    <Variant as="span" className="contents" key={minutes} name={pace.name} value={String(minutes)}>
      <StartPlanLink courseId={courseId} minutes={minutes} picked={minutes !== pace.firstShown} />
    </Variant>
  ));
}

/**
 * The course's way in: "Build my plan", whose start page asks the visitor's level first, and on the
 * first screen "Try a lesson" beside it, down to the card (`tryId`) when there's one to try, with
 * a short line that it's free and needs no account.
 */
export async function CourseStart({
  className,
  courseId,
  pace,
  tryId = null,
}: {
  className?: string;
  courseId: string;
  pace: PaceChoice | null;
  tryId?: string | null;
}) {
  const t = await getExtracted();

  return (
    <StartBlock
      className={cn(tryId && "sm:flex-col sm:items-start sm:gap-3", className)}
      note={<NoAccountNote>{t("Start free, no account needed.")}</NoAccountNote>}
    >
      {tryId ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <CoursePlanLink courseId={courseId} pace={pace} />
          <a className={getSecondaryStartControlClassName()} href={`#${tryId}`}>
            {t("Try a lesson")}
          </a>
        </div>
      ) : (
        <CoursePlanLink courseId={courseId} pace={pace} />
      )}
    </StartBlock>
  );
}
