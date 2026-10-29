import { CourseGoalSwitch } from "@/components/catalog/course-progress";
import { NoAccountStartNote } from "@/components/public/no-account-note";
import { StartBlock, getSecondaryStartControlClassName } from "@/components/public/public-start";
import { StartPlanLink } from "@/components/public/start-plan-link";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

function CoursePlanLink({ courseId, pace }: { courseId: string; pace: number | null }) {
  return (
    <CourseGoalSwitch
      continueLink={<StartPlanLink showContinueLabel courseId={courseId} />}
      courseId={courseId}
      startLinks={<StartPlanLink courseId={courseId} minutes={pace ?? undefined} />}
    />
  );
}

/** From `xl` the try card sits beside the hero, where a link to it would scroll nowhere. */
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
      className={cn(
        tryId && "sm:flex-col sm:items-start sm:gap-3 xl:flex-row xl:items-center xl:gap-5",
        className,
      )}
      note={<NoAccountStartNote>{t("Start free, no account needed.")}</NoAccountStartNote>}
    >
      {tryId ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <CoursePlanLink courseId={courseId} pace={pace} />
          <a className={cn(getSecondaryStartControlClassName(), "xl:hidden")} href={`#${tryId}`}>
            {t("Try a lesson")}
          </a>
        </div>
      ) : (
        <CoursePlanLink courseId={courseId} pace={pace} />
      )}
    </StartBlock>
  );
}
