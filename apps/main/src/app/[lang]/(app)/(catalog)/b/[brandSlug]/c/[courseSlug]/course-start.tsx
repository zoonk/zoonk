import { CourseGoalSwitch } from "@/components/catalog/course-progress";
import { NoAccountStartNote } from "@/components/public/no-account-note";
import { StartBlock, getSecondaryStartControlClassName } from "@/components/public/public-start";
import { StartPlanLink } from "@/components/public/start-plan-link";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/**
 * "Build my plan" with the example's default time a day, which the visitor hasn't picked. A learner whose goal
 * already follows the course gets "Continue your plan" in its place, which the start page sends
 * back to that goal: the page is the same for everyone, so the browser asks once it shows, and
 * until then, and for everyone else, it's the start link.
 */
function CoursePlanLink({ courseId, pace }: { courseId: string; pace: number | null }) {
  return (
    <CourseGoalSwitch
      continueLink={<StartPlanLink continues courseId={courseId} />}
      startLinks={<StartPlanLink courseId={courseId} minutes={pace ?? undefined} />}
    />
  );
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
  pace: number | null;
  tryId?: string | null;
}) {
  const t = await getExtracted();

  return (
    <StartBlock
      className={cn(tryId && "sm:flex-col sm:items-start sm:gap-3", className)}
      note={<NoAccountStartNote>{t("Start free, no account needed.")}</NoAccountStartNote>}
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
