import { HERO_LEAD_CLASS, PlanLine } from "@/components/catalog/catalog-hero";
import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { ChapterStrip } from "@/components/catalog/chapter-strip";
import { getExamChapterAreas } from "@/components/catalog/course-plan";
import { CourseProgressScope } from "@/components/catalog/course-progress";
import { TryLesson, getTryLessonId, pickTryLesson } from "@/components/catalog/try-lesson";
import { CheckMark } from "@/components/public/check-mark";
import { JsonLd } from "@/components/public/json-ld";
import { NoAccountStartNote } from "@/components/public/no-account-note";
import { PublicEyebrowLink } from "@/components/public/public-eyebrow-link";
import { StartBlock } from "@/components/public/public-start";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { StartPlanLink } from "@/components/public/start-plan-link";
import { type LibraryChapterRoute } from "@/data/catalog/resolve-catalog-route";
import { getCourseHref } from "@/data/courses/course-href";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getChapterUrls } from "@/lib/public/public-canonical";
import { getChapterHref, getLessonHref } from "@/lib/public/public-hrefs";
import { breadcrumbJsonLd, lessonListJsonLd } from "@/lib/public/structured-data";
import { ContentVoteMenu } from "@zoonk/learn/feedback/vote-menu";
import { Page, PageSection } from "@zoonk/learn/page";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { ChapterLessons } from "./chapter-lessons";

type Params = { brandSlug: string; courseSlug: string };

/**
 * The chapter's way in: "Build my plan", whose start page shows the plan from this chapter on
 * (`startChapterId`) or, for the course's first chapter or one whose lessons aren't written yet,
 * asks the visitor's level for the whole course.
 */
async function ChapterStart({
  className,
  courseId,
  hasLesson,
  startChapterId,
}: {
  className?: string;
  courseId: string;
  hasLesson: boolean;
  startChapterId: string | null;
}) {
  const t = await getExtracted();

  return (
    <StartBlock
      className={className}
      note={
        hasLesson ? (
          <NoAccountStartNote>{t("Start free, no account needed.")}</NoAccountStartNote>
        ) : (
          t("Start here and Zoonk writes its lessons for your level.")
        )
      }
    >
      <StartPlanLink chapterId={startChapterId} courseId={courseId} />
    </StartBlock>
  );
}

/** What the chapter teaches, under a quiet label beside its lessons. */
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
    <section aria-labelledby={titleId} className="flex flex-col gap-3.5">
      <h2 className="text-label" id={titleId}>
        {t("What you'll learn")}
      </h2>

      <ul className="flex flex-col gap-3">
        {objectives.map((objective) => (
          <li className="flex gap-3 text-[0.9375rem] leading-snug" key={objective}>
            <LineMarker>
              <CheckMark size="sm" />
            </LineMarker>
            <span className="text-pretty">{objective}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The page's last word, where it ends: the plan this chapter starts (or, for a chapter whose start
 * is the course's own, the course's at the visitor's level) and the one way in again.
 */
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
    <PageSection
      aria-labelledby={titleId}
      className="border-border max-w-wide gap-1 border-t pt-10"
    >
      <h2
        className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-2xl"
        id={titleId}
      >
        {startChapterId ? t("Your plan from this chapter") : t("Start today, at your level")}
      </h2>

      <p className="text-muted-foreground max-w-[600px] text-[0.9375rem] leading-relaxed text-pretty">
        {startChapterId
          ? t("It follows the course from here, at your pace, with reviews before you forget.")
          : t("A few quick questions, then your plan and your first lesson.")}
      </p>

      <ChapterStart
        className="mt-5 sm:mt-6"
        courseId={courseId}
        hasLesson={hasLesson}
        startChapterId={startChapterId}
      />
    </PageSection>
  );
}

/**
 * A Library chapter's page in the catalog, inside the app's frame like its course's, for a visitor
 * from a search on its topic: the bar back to the course, then the course it belongs to, what the
 * chapter teaches, what Zoonk does with it in one line and the one way to start; where it sits in
 * the course and the chapters after it; its lessons, one tap each, beside a question from one of
 * them to try and what it teaches; and the plan it starts, with the way in again. "Build my plan"
 * opens the course's start page with the plan from this chapter on, except for the course's first
 * chapter, which asks the visitor's level like the course's own page, and a chapter whose lessons
 * aren't written yet, which starts the course.
 */
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
    pickTryLesson(
      chapter.lessons.map((lesson, index) => ({
        chapterTitle: chapter.title,
        lessonId: lesson.id,
        number: index + 1,
      })),
    ),
    getExamChapterAreas(course),
    getChapterUrls({
      ...params,
      chapterId: chapter.id,
      chapterSlug: chapter.slug,
      language: course.language,
    }),
  ]);

  const hasAside = tryLesson !== null || chapter.objectives.length > 0;
  const area = areas?.get(chapter.id) ?? null;
  const titleId = `chapter-title-${chapter.id}`;

  return (
    <div className="flex flex-col gap-8">
      <CatalogPageBar
        back={{ href: getCourseHref(params), label: course.title }}
        options={
          <ContentVoteMenu
            label={t("Chapter options")}
            screen="chapter"
            size="icon-bar"
            target={{ contentId: chapter.id, contentKind: "chapter" }}
            votes={false}
          />
        }
        title={chapter.title}
      />

      <Page className="gap-16 sm:gap-20">
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

        <section aria-labelledby={titleId} className="max-w-column flex flex-col">
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm sm:text-[15px]">
            <PublicEyebrowLink href={getCourseHref(params)}>{course.title}</PublicEyebrowLink>
            {area && <span>{`· ${area}`}</span>}
          </p>

          <h1 className="text-title mt-2" id={titleId}>
            {chapter.title}
          </h1>

          <p className={HERO_LEAD_CLASS}>{chapter.description}</p>

          <PlanLine startsHere={Boolean(startChapterId)} />

          <ChapterStart
            courseId={course.id}
            hasLesson={hasLesson}
            startChapterId={startChapterId}
          />
        </section>

        <ChapterStrip areas={areas} chapterId={chapter.id} outline={outline} params={params} />

        {(hasLesson || hasAside) && (
          <div
            className={cn(
              "max-w-wide grid grid-cols-1 gap-12",
              hasLesson &&
                hasAside &&
                "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-8",
            )}
          >
            {hasLesson && <ChapterLessons params={params} route={route} />}

            {hasAside && (
              <div className="flex min-w-0 flex-col gap-8">
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
                <ChapterObjectives chapterId={chapter.id} objectives={chapter.objectives} />
              </div>
            )}
          </div>
        )}

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
