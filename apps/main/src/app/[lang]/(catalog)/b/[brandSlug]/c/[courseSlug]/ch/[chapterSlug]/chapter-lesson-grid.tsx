import { OptionalPractice } from "@/components/learning/optional-practice";
import { getOriginalCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { getChapter } from "@zoonk/core/chapters/get-by-slug";
import { listChapterLessons } from "@zoonk/core/lessons/list-by-chapter";
import { listChapterOptionalActivities } from "@zoonk/core/lessons/optional-activities";
import { getSession } from "@zoonk/core/users/session";
import { buttonVariants } from "@zoonk/ui/components/button";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { ChapterNotGenerated } from "./chapter-not-generated";
import { LessonList } from "./lesson-list";

/**
 * Loads the public lesson collection in its own stream. The app-level chapter
 * and lesson caches deduplicate the reads shared with the sidebar.
 */
export async function ChapterLessonGrid({
  params,
  searchParams,
}: Pick<
  PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">,
  "params" | "searchParams"
>) {
  const { brandSlug, chapterSlug, courseSlug } = await params;
  const search = await searchParams;
  const view = search.view === "curriculum" ? "curriculum" : "teaching";

  const chapter = await getChapter({ brandSlug, chapterSlug, courseSlug });

  if (!chapter) {
    notFound();
  }

  const [lessons, optional, session] = await Promise.all([
    listChapterLessons({ chapterId: chapter.id, view }),
    listChapterOptionalActivities({ chapterId: chapter.id, view }),
    getSession(),
  ]);

  if (
    (brandSlug === AI_ORG_SLUG || brandSlug === "me") &&
    chapter.generationStatus !== "completed" &&
    lessons.length === 0
  ) {
    return (
      <ChapterNotGenerated
        chapterId={chapter.id}
        courseHref={getOriginalCourseHref({ brandSlug, courseSlug })}
      />
    );
  }

  const t = await getExtracted();

  return (
    <>
      <LessonList
        brandSlug={brandSlug}
        chapterId={chapter.id}
        chapterSlug={chapterSlug}
        courseSlug={courseSlug}
        lessons={lessons}
        view={view}
      />
      {optional.status === "ready" && (
        <OptionalPractice groups={optional.groups} isAuthenticated={Boolean(session)}>
          {optional.reviews.length > 0 && (
            <div className="space-y-2 py-4">
              {optional.reviews.map((review, index) => (
                <Link
                  className={buttonVariants({ className: "min-h-11", variant: "outline" })}
                  key={review.id}
                  href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${review.slug}`}
                >
                  {optional.reviews.length === 1
                    ? t("Review what you've learned")
                    : review.title || t("Review {number}", { number: String(index + 1) })}
                </Link>
              ))}
            </div>
          )}
        </OptionalPractice>
      )}
    </>
  );
}
