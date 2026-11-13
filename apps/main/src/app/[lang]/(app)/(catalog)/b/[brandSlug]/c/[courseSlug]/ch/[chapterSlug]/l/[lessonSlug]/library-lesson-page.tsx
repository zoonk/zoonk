import { COURSE_TITLE_CLASS, LESSON_LEAD_CLASS } from "@/components/catalog/catalog-hero";
import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { CourseProgressScope } from "@/components/catalog/course-progress";
import { PublicEyebrowLink } from "@/components/public/public-eyebrow-link";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { getCourseHref } from "@/data/courses/course-href";
import { getLessonUrls } from "@/lib/public/public-canonical";
import { getChapterHref, getLessonHref, getLessonPlayerPath } from "@/lib/public/public-hrefs";
import { getLevelLabels } from "@/lib/public/public-labels";
import { type PublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { Page } from "@zoonk/learn/page";
import { PageWithAside } from "@zoonk/learn/shell";
import { SubjectGlyph, getSubject } from "@zoonk/learn/subject-label";
import { PAGE_HEADER_CLASS } from "@zoonk/ui/components/page-header-class";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { LessonChapterAside } from "./lesson-chapter-aside";
import { LessonCourseStart } from "./lesson-course-start";
import { LessonFirstScreen } from "./lesson-first-screen";
import { LessonJsonLd } from "./lesson-json-ld";
import { LessonMore } from "./lesson-more";

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
  const ideas = lesson.summary?.ideas.map((idea) => idea.text) ?? [];
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
      <div className="flex flex-col" data-subject={subject}>
        <CatalogPageBar
          back={{
            href: getChapterHref({ ...params, chapterSlug: chapter.slug }),
            label: chapter.title,
          }}
          title={lesson.title}
        />

        <Page className="gap-16 sm:gap-24">
          <PublicViewTracker contentId={lesson.id} page="lesson" />

          <LessonJsonLd
            breadcrumbs={[
              { name: course.title, url: urls.course },
              { name: chapter.title, url: urls.chapter },
              { name: lesson.title, url: urls.current },
            ]}
            lesson={{
              course: { name: course.title, url: urls.course },
              description: lesson.description,
              language: course.language,
              level: levelLabels[chapter.level],
              minutes: lesson.estimatedMinutes,
              name: lesson.title,
              teaches: ideas,
              url: urls.canonical,
            }}
          />

          <article
            aria-labelledby={titleId}
            className={cn(PAGE_HEADER_CLASS, "max-w-column gap-0")}
          >
            <p className="text-muted-foreground sm:text-reading flex items-center gap-2 text-sm">
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

            <LessonMore ideas={ideas} params={params} route={route} />
          </article>

          <LessonCourseStart route={route} />
        </Page>
      </div>
    </PageWithAside>
  );
}
