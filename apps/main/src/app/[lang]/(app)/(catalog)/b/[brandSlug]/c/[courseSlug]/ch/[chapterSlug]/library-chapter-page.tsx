import {
  COURSE_HERO_CLASS,
  COURSE_HERO_PAIR_CLASS,
  COURSE_TITLE_CLASS,
  HERO_LEAD_CLASS,
  PlanLine,
} from "@/components/catalog/catalog-hero";
import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { ChapterStrip } from "@/components/catalog/chapter-strip";
import { CourseProgressScope } from "@/components/catalog/course-progress";
import { TryLesson, getTryLessonId } from "@/components/catalog/try-lesson";
import { CheckItem } from "@/components/public/check-mark";
import { JsonLd } from "@/components/public/json-ld";
import { StartBlock } from "@/components/public/public-start";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { StartFreeNote } from "@/components/public/start-free-note";
import { StartPlanLink } from "@/components/public/start-plan-link";
import { type LibraryChapterRoute } from "@/data/catalog/resolve-catalog-route";
import { getCourseHref } from "@/data/courses/course-href";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getChapterUrls } from "@/lib/public/public-canonical";
import { getChapterHref, getLessonHref } from "@/lib/public/public-hrefs";
import { breadcrumbJsonLd, lessonListJsonLd } from "@/lib/public/structured-data";
import { getExamChapterAreas } from "@zoonk/core/catalog/course-plan-example";
import { pickTryLesson } from "@zoonk/core/catalog/try-lesson";
import { ContentFeedbackMenu } from "@zoonk/learn/feedback/content-menu";
import { Page, PageSection } from "@zoonk/learn/page";
import { getSubject } from "@zoonk/learn/subject-label";
import { PAGE_HEADER_CLASS } from "@zoonk/ui/components/page-header-class";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { ChapterLessons } from "./chapter-lessons";

type Params = { brandSlug: string; courseSlug: string };

async function ChapterStart({
  className,
  courseId,
  hasLesson,
  pricing = false,
  startChapterId,
}: {
  className?: string;
  courseId: string;
  hasLesson: boolean;
  pricing?: boolean;
  startChapterId: string | null;
}) {
  const t = await getExtracted();

  return (
    <StartBlock
      className={className}
      note={
        hasLesson ? <StartFreeNote pricing={pricing} /> : t("Its lessons get ready when you start.")
      }
    >
      <StartPlanLink chapterId={startChapterId} courseId={courseId} />
    </StartBlock>
  );
}

async function ChapterObjectives({
  chapterId,
  objectives,
}: {
  chapterId: string;
  objectives: string[];
}) {
  const t = await getExtracted();

  if (objectives.length === 0) {
    return null;
  }

  const titleId = `chapter-objectives-${chapterId}`;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h2 className="text-section" id={titleId}>
        {t("What you'll learn")}
      </h2>

      <ul className="flex flex-col">
        {objectives.map((objective) => (
          <CheckItem className="text-reading py-3 leading-5 last:pb-0" key={objective}>
            {objective}
          </CheckItem>
        ))}
      </ul>
    </section>
  );
}

async function ChapterClosing({
  chapterId,
  courseId,
  hasLesson,
  startChapterId,
}: {
  chapterId: string;
  courseId: string;
  hasLesson: boolean;
  startChapterId: string | null;
}) {
  const t = await getExtracted();
  const titleId = `chapter-closing-${chapterId}`;

  return (
    <PageSection aria-labelledby={titleId} className="gap-1.5">
      <h2 className="text-section" id={titleId}>
        {startChapterId
          ? t("Start from this chapter")
          : t({
              description:
                "Heading over the ways to start a plan. “your level” is what the learner already knows.",
              message: "Start today, at your level",
            })}
      </h2>

      <p className="text-muted-foreground max-w-column text-reading leading-relaxed text-pretty">
        {startChapterId
          ? t("You get a plan for each day, from this chapter to the end of the course.")
          : t("A few quick questions, then your plan and your first lesson.")}
      </p>

      <ChapterStart
        className="mt-5 sm:mt-6"
        courseId={courseId}
        hasLesson={hasLesson}
        pricing
        startChapterId={startChapterId}
      />
    </PageSection>
  );
}

export async function LibraryChapterPage({
  locale,
  params,
  route,
}: {
  locale: SupportedLocale;
  params: Params;
  route: LibraryChapterRoute;
}) {
  const { chapter, course, number, outline } = route;
  const hasLesson = chapter.lessons.length > 0;
  const startChapterId = hasLesson && number > 1 ? chapter.id : null;
  const t = await getExtracted();

  const [tryLesson, areas, urls] = await Promise.all([
    pickTryLesson([chapter]),
    getExamChapterAreas(course),
    getChapterUrls({
      ...params,
      chapterId: chapter.id,
      chapterSlug: chapter.slug,
      language: course.language,
    }),
  ]);

  const hasObjectives = chapter.objectives.length > 0;
  const titleId = `chapter-title-${chapter.id}`;
  const subject = getSubject(course.categories);

  return (
    <div className="flex flex-col" data-subject={subject}>
      <CatalogPageBar
        back={{ href: getCourseHref(params), label: course.title }}
        options={
          <ContentFeedbackMenu
            label={t("Chapter options")}
            screen="chapter"
            size="icon-bar"
            target={{ contentId: chapter.id, contentKind: "chapter" }}
          />
        }
        title={chapter.title}
      />

      <Page className="gap-16 sm:gap-24">
        <PublicViewTracker contentId={chapter.id} page="chapter" />

        <JsonLd
          items={[
            lessonListJsonLd({
              lessons: chapter.lessons.map((lesson) => ({
                name: lesson.title,
                url: getLocalizedUrl({
                  href: getLessonHref({
                    ...params,
                    chapterSlug: chapter.slug,
                    lessonSlug: lesson.slug,
                  }),
                  language: course.language,
                }),
              })),
              name: chapter.title,
              url: urls.canonical,
            }),
            breadcrumbJsonLd([
              { name: course.title, url: urls.course },
              { name: chapter.title, url: urls.current },
            ]),
          ]}
        />

        <div className={cn(COURSE_HERO_CLASS, tryLesson && COURSE_HERO_PAIR_CLASS)}>
          <section
            aria-labelledby={titleId}
            className={cn(PAGE_HEADER_CLASS, "max-w-column gap-0")}
          >
            <h1 className={COURSE_TITLE_CLASS} id={titleId}>
              {chapter.title}
            </h1>

            <p className={HERO_LEAD_CLASS}>{chapter.description}</p>

            <PlanLine start={startChapterId ? "chapter" : "known"} />

            <ChapterStart
              courseId={course.id}
              hasLesson={hasLesson}
              startChapterId={startChapterId}
            />
          </section>

          {tryLesson && (
            <CourseProgressScope courseId={course.id} lessonId={tryLesson.lessonId}>
              <TryLesson
                id={getTryLessonId(chapter.id)}
                locale={locale}
                origin={getChapterHref({ ...params, chapterSlug: chapter.slug })}
                pick={tryLesson}
              />
            </CourseProgressScope>
          )}
        </div>

        {(hasLesson || hasObjectives) && (
          <div
            className={cn(
              "grid grid-cols-1 gap-16 sm:gap-24",
              hasLesson &&
                hasObjectives &&
                "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-16",
            )}
          >
            {hasLesson && <ChapterLessons params={params} route={route} />}
            <ChapterObjectives chapterId={chapter.id} objectives={chapter.objectives} />
          </div>
        )}

        <ChapterStrip
          areas={areas}
          chapterId={chapter.id}
          course={course.title}
          outline={outline}
          params={params}
        />

        <ChapterClosing
          chapterId={chapter.id}
          courseId={course.id}
          hasLesson={hasLesson}
          startChapterId={startChapterId}
        />
      </Page>
    </div>
  );
}
