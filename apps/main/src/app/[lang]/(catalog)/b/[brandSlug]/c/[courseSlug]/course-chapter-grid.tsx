import { GeneratedCourseCacheRefresher } from "@/components/catalog/generated-course-cache-refresher";
import { type CourseChapter, listCourseChapters } from "@/data/chapters/list-course-chapters";
import { type CourseWithDetails, getCourse } from "@/data/courses/get-course";
import { getUserHiddenLessonKinds } from "@/data/users/lesson-filter-settings";
import { redirect } from "@/i18n/navigation";
import { getDefaultChapterImage } from "@/lib/catalog/default-images";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { notFound } from "next/navigation";
import { ChapterList } from "./chapter-list";

/**
 * The temporary intro-only state should be shown only while a regular AI course
 * is still being generated. Completed one-chapter courses and language courses
 * are legitimate short curricula, so chapter count alone is not enough.
 */
function isCurriculumStillGenerating({
  brandSlug,
  chapters,
  course,
}: {
  brandSlug: string;
  chapters: CourseChapter[];
  course: CourseWithDetails;
}): boolean {
  if (brandSlug !== AI_ORG_SLUG || course.targetLanguage || course.generationStatus !== "running") {
    return false;
  }

  const onlyChapter = chapters[0];

  return chapters.length === 1 && onlyChapter?.position === 0;
}

/**
 * Loads the public chapter collection in its own stream. The app-level course
 * and chapter caches deduplicate the reads shared with the sidebar.
 */
export async function CourseChapterGrid({
  params,
}: Pick<PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">, "params">) {
  const { brandSlug, courseSlug, lang: locale } = await params;

  const [course, hiddenLessonKinds] = await Promise.all([
    getCourse({ brandSlug, courseSlug }),
    getUserHiddenLessonKinds(),
  ]);

  if (!course) {
    notFound();
  }

  const chapters = await listCourseChapters({ courseId: course.id });

  if (brandSlug === AI_ORG_SLUG && chapters.length === 0) {
    return redirect({ href: `/generate/c/${course.slug}`, locale });
  }

  const isCurriculumPending = isCurriculumStillGenerating({ brandSlug, chapters, course });

  return (
    <>
      {isCurriculumPending && <GeneratedCourseCacheRefresher courseId={course.id} />}

      <ChapterList
        brandSlug={brandSlug}
        chapters={chapters}
        courseId={course.id}
        courseSlug={courseSlug}
        defaultChapterImage={getDefaultChapterImage({ categories: course.categories })}
        hiddenLessonKinds={hiddenLessonKinds}
        isCurriculumPending={isCurriculumPending}
      />
    </>
  );
}
