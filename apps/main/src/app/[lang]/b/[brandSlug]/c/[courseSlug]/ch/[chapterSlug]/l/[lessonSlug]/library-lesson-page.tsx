import { JsonLd } from "@/components/public/json-ld";
import { HERO_LEAD_CLASS, HERO_TITLE_CLASS } from "@/components/public/landing-styles";
import { PublicEyebrowLink } from "@/components/public/public-eyebrow-link";
import { PublicPage } from "@/components/public/public-page";
import { StartLink, StickyStart } from "@/components/public/public-start";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { StartLessonButton } from "@/components/public/start-lesson-button";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { getCourseHref } from "@/data/courses/course-href";
import { getLessonUrls } from "@/lib/public/public-canonical";
import { getLessonPlayerPath } from "@/lib/public/public-hrefs";
import { getLevelLabel, getMinutesLabel } from "@/lib/public/public-labels";
import { breadcrumbJsonLd, lessonJsonLd } from "@/lib/public/structured-data";
import { type PublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { FirstScreenCard } from "./first-screen-card";
import { LessonMore } from "./lesson-more";

type Params = { brandSlug: string; courseSlug: string };

/**
 * The public page of a Library lesson, the same for visitors and search engines: the course it
 * belongs to, the title, why it matters in one line and the first screen as the only next step.
 * What you'll learn and the rest of the chapter wait below, folded away. Only this public part is
 * in the HTML; every other screen loads in the player after the first answer.
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

  const [t, minutesLabel, levelLabel, urls] = await Promise.all([
    getExtracted(),
    getMinutesLabel(lesson.estimatedMinutes),
    getLevelLabel(chapter.level),
    getLessonUrls({
      ...params,
      chapterSlug: chapter.slug,
      language: course.language,
      lessonId: lesson.id,
      lessonSlug: lesson.slug,
    }),
  ]);

  const stickyLabel = (
    <>
      {t("Start the lesson")}
      <span aria-hidden="true" className="size-1 rounded-full bg-current opacity-60" />
      <span className="font-normal opacity-60">{minutesLabel}</span>
    </>
  );

  return (
    <PublicPage>
      <PublicViewTracker contentId={lesson.id} page="lesson" />

      <JsonLd
        items={[
          lessonJsonLd({
            course: { name: course.title, url: urls.course },
            description: lesson.description,
            language: course.language,
            level: levelLabel,
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

      <article className="mx-auto w-full max-w-[680px] px-5 pt-8 pb-24 sm:px-8 sm:pt-14 sm:pb-32">
        <PublicEyebrowLink href={getCourseHref(params)}>{course.title}</PublicEyebrowLink>

        <h1 className={cn(HERO_TITLE_CLASS, "mt-3 sm:mt-4 lg:text-5xl")}>{lesson.title}</h1>

        <p className={HERO_LEAD_CLASS}>{lesson.description}</p>

        <FirstScreenCard
          lessonId={lesson.id}
          minutes={lesson.estimatedMinutes}
          playerPath={playerPath}
          screen={lesson.firstScreen}
        />

        <LessonMore ideas={lesson.summaryIdeas} params={params} route={route} />
      </article>

      <StickyStart>
        {lesson.firstScreen ? (
          <StartLink className="w-full" href={playerPath}>
            {stickyLabel}
          </StartLink>
        ) : (
          <StartLessonButton action={playerPath} className="w-full" lessonId={lesson.id}>
            {stickyLabel}
          </StartLessonButton>
        )}
      </StickyStart>
    </PublicPage>
  );
}
