import { Link } from "@/i18n/navigation";
import { type getLessonHref } from "@/lib/public/public-hrefs";
import { getMinutesLabel } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";

export type LibraryLessonRow = {
  description?: string;
  href: ReturnType<typeof getLessonHref>;
  id: string;
  minutes: number;
  title: string;
};

/**
 * A chapter's lessons in order, one tap each. The lesson being viewed stays
 * highlighted so the list also says where you are.
 */
export async function LibraryLessonRows({
  currentLessonId,
  lessons,
}: {
  currentLessonId?: string;
  lessons: LibraryLessonRow[];
}) {
  const minuteLabels = await Promise.all(lessons.map((lesson) => getMinutesLabel(lesson.minutes)));

  return (
    <ol className="-mx-3 sm:-mx-3.5">
      {lessons.map((lesson, index) => {
        const isCurrent = lesson.id === currentLessonId;

        return (
          <li key={lesson.id}>
            <Link
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                // The number and the minutes stay on the title's first line, however long it is.
                "focus-visible:ring-ring/50 flex items-baseline gap-3 rounded-[14px] px-3 py-3 text-[15px] transition-colors outline-none focus-visible:ring-[3px] sm:px-3.5 sm:py-3.5 sm:text-base",
                isCurrent ? "bg-muted font-semibold" : "hover:bg-muted/60",
              )}
              href={lesson.href}
            >
              <span
                className={cn(
                  "w-5 flex-none text-[13px] font-medium tabular-nums sm:w-6 sm:text-sm",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {index + 1}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="leading-snug text-pretty">{lesson.title}</span>
                {lesson.description && (
                  <span className="text-muted-foreground text-sm leading-snug font-normal text-pretty">
                    {lesson.description}
                  </span>
                )}
              </span>

              <span className="text-muted-foreground flex-none text-[13px] font-normal tabular-nums sm:text-sm">
                {minuteLabels[index]}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
