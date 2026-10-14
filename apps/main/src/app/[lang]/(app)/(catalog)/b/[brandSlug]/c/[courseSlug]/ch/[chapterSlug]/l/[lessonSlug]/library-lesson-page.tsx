import { LESSON_LEAD_CLASS } from "@/components/catalog/catalog-hero";
import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
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
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { LessonChapterAside } from "./lesson-chapter-aside";
import { LessonFirstScreen } from "./lesson-first-screen";
import { LessonMore } from "./lesson-more";
import { LessonPlanDay } from "./lesson-plan-day";

type Params = { brandSlug: string; courseSlug: string };

/**
 * A Library lesson's page in the catalog, the same for visitors and search engines, inside the
 * app's frame like its course and chapter: the bar back to the chapter, then the course it belongs
 * to, the title, why it matters in one line and the first screen right on the page as the only
 * next step, then what it teaches, folded away; beside it from 72rem its chapter's lessons with
 * this one marked (folded under the question before that). Under the lesson, one day of its
 * course's plan with this lesson in it and a quieter way to build that plan. Only this public
 * part is in the HTML; every other screen loads in the player after the first answer.
 */
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

  const t = await getExtracted();
  const levelLabels = await getLevelLabels();

  const urls = await getLessonUrls({
    ...params,
    chapterSlug: chapter.slug,
    language: course.language,
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
  });

  return (
    <PageWithAside
      aside={<LessonChapterAside params={params} route={route} />}
      asideClassName="hidden min-[72rem]:flex"
      asideLabel={t("Lessons")}
    >
      <div className="flex flex-col gap-8">
        <CatalogPageBar
          back={{
            href: getChapterHref({ ...params, chapterSlug: chapter.slug }),
            label: chapter.title,
          }}
          title={lesson.title}
        />

        <Page className="gap-16 sm:gap-20">
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
            <PublicEyebrowLink href={getCourseHref(params)}>{course.title}</PublicEyebrowLink>

            <h1 className="text-title mt-2" id={titleId}>
              {lesson.title}
            </h1>

            <p className={LESSON_LEAD_CLASS}>{lesson.description}</p>

            <LessonFirstScreen
              lessonId={lesson.id}
              minutes={lesson.estimatedMinutes}
              origin={getLessonHref({
                ...params,
                chapterSlug: chapter.slug,
                lessonSlug: lesson.slug,
              })}
              playerPath={playerPath}
              screen={lesson.firstScreen}
            />

            <LessonMore ideas={lesson.summaryIdeas} params={params} route={route} />
          </article>

          <LessonPlanDay route={route} />
        </Page>
      </div>
    </PageWithAside>
  );
}
