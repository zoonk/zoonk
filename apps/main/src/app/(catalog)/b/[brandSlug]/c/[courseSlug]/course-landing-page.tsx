import { type CourseChapter } from "@/data/chapters/list-course-chapters";
import { type CourseWithDetails } from "@/data/courses/get-course";
import { type CourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { type LessonKind } from "@zoonk/db";
import { type CourseCategory } from "@zoonk/utils/categories";
import { CourseLandingDecisionTabs } from "./course-landing-page-decision-tabs";
import { CourseLandingHero } from "./course-landing-page-hero";

const CREDENTIAL_NOTE_CATEGORIES = new Set<string>(["health", "law"] satisfies CourseCategory[]);

/**
 * Presents a course like a landing page until the learner has progress. Once a
 * learner starts, the parent route switches back to the chapter grid because
 * navigation becomes more important than persuasion.
 */
export function CourseLandingPage({
  brandSlug,
  chapters,
  course,
  courseSlug,
  excludedLessonKinds,
  isCurriculumPending,
  landingPage,
}: {
  brandSlug: string;
  chapters: CourseChapter[];
  course: CourseWithDetails;
  courseSlug: string;
  excludedLessonKinds: LessonKind[];
  isCurriculumPending: boolean;
  landingPage: CourseLandingPageContent | null;
}) {
  const firstChapter = chapters[0];
  const isLanguageCourse = Boolean(course.targetLanguage);

  const shouldShowCredentialNote = hasCredentialSensitiveCategory({
    categories: course.categories,
  });

  const firstChapterHref = firstChapter
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${firstChapter.slug}` as const)
    : null;

  const heroCopy = isLanguageCourse
    ? course.description
    : landingPage?.valueProposition || course.description;

  return (
    <main className="bg-background w-full flex-1">
      <CourseLandingHero
        course={course}
        excludedLessonKinds={excludedLessonKinds}
        firstChapterHref={firstChapterHref}
        heroCopy={heroCopy}
      />

      <CourseLandingDecisionTabs
        audience={landingPage?.audience ?? []}
        chapters={chapters}
        isCurriculumPending={isCurriculumPending}
        isLanguageCourse={isLanguageCourse}
        opportunities={landingPage?.opportunities ?? []}
        outcomes={landingPage?.outcomes ?? []}
        showCredentialNote={shouldShowCredentialNote}
      />
    </main>
  );
}

/**
 * The credential disclaimer only matters for categories where learners might
 * confuse course completion with permission to practice a regulated profession.
 * Other subjects should not carry legal-sounding caveats that make the landing
 * page feel heavier than it needs to.
 */
function hasCredentialSensitiveCategory({
  categories,
}: {
  categories: CourseWithDetails["categories"];
}) {
  return categories.some((item) => CREDENTIAL_NOTE_CATEGORIES.has(item.category));
}
