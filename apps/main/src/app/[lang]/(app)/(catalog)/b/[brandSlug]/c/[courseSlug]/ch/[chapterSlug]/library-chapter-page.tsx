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
import { getExamChapterAreas } from "@zoonk/core/catalog/course-plan-example";
import { pickTryLesson } from "@zoonk/core/catalog/try-lesson";
import { ContentFeedbackMenu } from "@zoonk/learn/feedback/content-menu";
import { Page, PageSection } from "@zoonk/learn/page";
import { SubjectGlyph, getSubject } from "@zoonk/learn/subject-label";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { ChapterLessons } from "./chapter-lessons";

type Params = { brandSlug: string; courseSlug: string };

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
    <PageSection aria-labelledby={titleId} className="gap-1.5 border-t pt-12 sm:pt-16">
      <h2 className="text-section" id={titleId}>
        {startChapterId
          ? t("Your plan from this chapter")
          : t({
              description:
                "Heading over the ways to start a plan. “your level” is what the learner already knows.",
              message: "Start today, at your level",
            })}
      </h2>

      <p className="text-muted-foreground max-w-column text-[0.9375rem] leading-relaxed text-pretty">
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
  const area = areas?.get(chapter.id) ?? null;
  const titleId = `chapter-title-${chapter.id}`;
  const subject = getSubject(course.categories);

  return (
    <div className="flex flex-col gap-8" data-subject={subject}>
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

      <Page className="gap-16 pt-2 sm:gap-24 sm:pt-4">
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
          <section aria-labelledby={titleId} className="max-w-column flex min-w-0 flex-col">
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm sm:text-[15px]">
              <SubjectGlyph subject={subject} />
              <PublicEyebrowLink href={getCourseHref(params)}>{course.title}</PublicEyebrowLink>
              {area && <span>{`· ${area}`}</span>}
            </p>

            <h1 className={cn(COURSE_TITLE_CLASS, "mt-2")} id={titleId}>
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

        <ChapterStrip areas={areas} chapterId={chapter.id} outline={outline} params={params} />

        {(hasLesson || hasObjectives) && (
          <div
            className={cn(
              "grid grid-cols-1 gap-12",
              hasLesson &&
                hasObjectives &&
                "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-16",
            )}
          >
            {hasLesson && <ChapterLessons params={params} route={route} />}
            <ChapterObjectives chapterId={chapter.id} objectives={chapter.objectives} />
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
