import { type CourseChapter } from "@/data/chapters/list-course-chapters";
import { ChevronDownIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type CoursePathGroup, getCoursePathGroups } from "./_utils/course-path-groups";
import { CourseCurriculumPendingNotice } from "./course-curriculum-pending-notice";
import { CourseLandingPanelTitle } from "./course-landing-page-sections";

/**
 * Chapter ranges make grouped sections feel like one continuous path instead
 * of separate modules that might imply different commitments.
 */
function getChapterRangeLabel({ group }: { group: CoursePathGroup }) {
  const endNumber = group.startNumber + group.chapters.length - 1;
  return `${String(group.startNumber).padStart(2, "0")}-${String(endNumber).padStart(2, "0")}`;
}

/**
 * Prospective learners need to see the course shape, not read every chapter
 * description. Grouped native disclosure sections keep every title available
 * without letting a 70-chapter path swallow the whole landing page.
 */
export async function CourseLandingCurriculum({
  chapters,
  isCurriculumPending,
}: {
  chapters: CourseChapter[];
  isCurriculumPending: boolean;
}) {
  if (chapters.length === 0) {
    return null;
  }

  const t = await getExtracted();
  const groupLabels = [t("Introduction"), t("Basics"), t("Intermediate"), t("Advanced")];
  const groups = getCoursePathGroups({ chapters, labels: groupLabels });

  return (
    <section className="w-full">
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <CourseLandingPanelTitle>{t("Course content")}</CourseLandingPanelTitle>
          <p className="text-muted-foreground font-mono text-[0.68rem] tracking-[0.24em] uppercase">
            {t("{count, plural, one {# chapter} other {# chapters}}", { count: chapters.length })}
          </p>
        </div>
        <p className="text-muted-foreground max-w-2xl text-base leading-7">
          {t(
            "Start with the basics, then move toward more advanced topics. Open a section to scan the chapters.",
          )}
        </p>
        {isCurriculumPending && <CourseCurriculumPendingNotice />}
      </div>

      <div className="bg-muted/30 divide-border/60 divide-y rounded-lg px-5">
        {groups.map((group, index) => (
          <details className="group" key={group.title} open={index === 0}>
            <summary className="focus-visible:ring-ring/50 hover:text-info flex cursor-pointer list-none items-center justify-between gap-6 py-5 transition-colors outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
              <span className="flex flex-col gap-1">
                <span className="text-info font-mono text-[0.68rem] tracking-[0.24em] uppercase">
                  {getChapterRangeLabel({ group })}
                </span>
                <span className="block text-lg font-semibold">{group.title}</span>
              </span>
              <ChevronDownIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>

            <ol className="flex flex-col gap-3 pb-6">
              {group.chapters.map((chapter, chapterIndex) => (
                <li
                  className="grid grid-cols-[max-content_1fr] items-baseline gap-3"
                  key={chapter.id}
                >
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {String(group.startNumber + chapterIndex).padStart(2, "0")}
                  </span>
                  <span className="text-sm leading-6 font-medium">{chapter.title}</span>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
