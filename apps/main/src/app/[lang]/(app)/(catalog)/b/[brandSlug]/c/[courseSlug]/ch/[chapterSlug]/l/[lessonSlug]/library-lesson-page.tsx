import { COURSE_TITLE_CLASS, LESSON_LEAD_CLASS } from "@/components/catalog/catalog-hero";
import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { CourseProgressScope } from "@/components/catalog/course-progress";
import { JsonLd } from "@/components/public/json-ld";
import { PublicEyebrowLink } from "@/components/public/public-eyebrow-link";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { getCourseHref } from "@/data/courses/course-href";
import { getLessonUrls } from "@/lib/public/public-canonical";
import { getChapterHref, getLessonHref, getLessonPlayerPath } from "@/lib/public/public-hrefs";
import { getLevelLabels } from "@/lib/public/public-labels";
import { breadcrumbJsonLd, lessonJsonLd } from "@/lib/public/structured-data";
import { type PublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { Page } from "@zoonk/learn/page";
import { PageWithAside } from "@zoonk/learn/shell";
import { SubjectGlyph, getSubject } from "@zoonk/learn/subject-label";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { LessonChapterAside } from "./lesson-chapter-aside";
import { LessonFirstScreen } from "./lesson-first-screen";
import { LessonMore } from "./lesson-more";
import { LessonPlanDay } from "./lesson-plan-day";

type Params = { brandSlug: string; courseSlug: string };

/** Only this public part is in the HTML; every other screen loads in the player after the first answer. */
export async function LibraryLessonPage({
  lesson,
  locale,
  params,
  route,
}: {
  lesson: PublicLibraryLesson;
  locale: SupportedLocale;
  params: Params;
  route: LibraryLessonRoute;
}) {
  const { chapter, course } = route;
  const playerPath = getLessonPlayerPath({ lessonId: lesson.id, locale });
  const titleId = `lesson-title-${lesson.id}`;
  const subject = getSubject(course.categories);

  const t = await getExtracted();
  const levelLabels = await getLevelLabels();

  const urls = await getLessonUrls({
    ...params,
    chapterSlug: chapter.slug,
    language: course.language,
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
  });

  // Only a question has a learner's version ("Continue the lesson"), read in the browser.
  const firstScreen = (
    <LessonFirstScreen
      lessonId={lesson.id}
      minutes={lesson.estimatedMinutes}
      origin={getLessonHref({ ...params, chapterSlug: chapter.slug, lessonSlug: lesson.slug })}
      playerPath={playerPath}
      screen={lesson.firstScreen}
    />
  );

  return (
    <PageWithAside
      aside={<LessonChapterAside params={params} route={route} />}
      asideClassName="hidden min-[72rem]:flex"
      asideLabel={t("Lessons")}
    >
      <div className="flex flex-col gap-8" data-subject={subject}>
        <CatalogPageBar
          back={{
            href: getChapterHref({ ...params, chapterSlug: chapter.slug }),
            label: chapter.title,
          }}
          title={lesson.title}
        />

        <Page className="gap-16 pt-2 sm:gap-24 sm:pt-4">
          <PublicViewTracker contentId={lesson.id} page="lesson" />

          <JsonLd
            items={[
              lessonJsonLd({
                course: { name: course.title, url: urls.course },
                description: lesson.description,
                language: course.language,
                level: levelLabels[chapter.level],
                minutes: lesson.estimatedMinutes,
                name: lesson.title,
                teaches: lesson.summaryIdeas,
                url: urls.canonical,
              }),
              breadcrumbJsonLd([
                { name: course.title, url: urls.course },
                { name: chapter.title, url: urls.chapter },
                { name: lesson.title, url: urls.current },
              ]),
            ]}
          />

          <article aria-labelledby={titleId} className="max-w-column flex flex-col">
            <p className="text-muted-foreground flex items-center gap-2 text-sm sm:text-[15px]">
              <SubjectGlyph subject={subject} />
              <PublicEyebrowLink href={getCourseHref(params)}>{course.title}</PublicEyebrowLink>
            </p>

            <h1 className={cn(COURSE_TITLE_CLASS, "mt-2")} id={titleId}>
              {lesson.title}
            </h1>

            <p className={LESSON_LEAD_CLASS}>{lesson.description}</p>

            {lesson.firstScreen?.kind === "choice" ? (
              <CourseProgressScope courseId={course.id} lessonId={lesson.id}>
                {firstScreen}
              </CourseProgressScope>
            ) : (
              firstScreen
            )}

            <LessonMore ideas={lesson.summaryIdeas} params={params} route={route} />
          </article>

          <LessonPlanDay route={route} />
        </Page>
      </div>
    </PageWithAside>
  );
}
