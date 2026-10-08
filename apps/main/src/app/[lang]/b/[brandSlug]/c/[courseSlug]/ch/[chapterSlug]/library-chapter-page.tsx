import { CheckCircle } from "@/components/public/check-circle";
import { CourseStartProvider } from "@/components/public/course-start-context";
import { JsonLd } from "@/components/public/json-ld";
import { HERO_CLASS, HERO_LEAD_CLASS, HERO_TITLE_CLASS } from "@/components/public/landing-styles";
import { NoAccountNote } from "@/components/public/no-account-note";
import { PublicEyebrowLink } from "@/components/public/public-eyebrow-link";
import { PublicPage } from "@/components/public/public-page";
import { PublicStart } from "@/components/public/public-start";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { StartCourseButton } from "@/components/public/start-course-button";
import { type LibraryChapterRoute } from "@/data/catalog/resolve-catalog-route";
import { getCourseHref } from "@/data/courses/course-href";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getChapterUrls } from "@/lib/public/public-canonical";
import { getLessonHref } from "@/lib/public/public-hrefs";
import { breadcrumbJsonLd, lessonListJsonLd } from "@/lib/public/structured-data";
import { ContentVoteMenu } from "@zoonk/learn/feedback/vote-menu";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { ChapterLessonsCard } from "./chapter-lessons-card";

type Params = { brandSlug: string; courseSlug: string };

async function ChapterObjectives({ objectives }: { objectives: string[] }) {
  const t = await getExtracted();

  if (objectives.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="chapter-objectives" className="mt-12 max-w-[560px] sm:mt-14">
      <h2
        className="text-[19px] font-semibold tracking-[-0.015em] sm:text-xl"
        id="chapter-objectives"
      >
        {t("What you'll learn")}
      </h2>

      <ul className="mt-4 flex flex-col gap-3">
        {objectives.map((objective) => (
          <li className="flex gap-3 text-[15px] leading-snug sm:text-base" key={objective}>
            <LineMarker>
              <CheckCircle size="sm" />
            </LineMarker>
            <span className="text-pretty">{objective}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The public page of a Library chapter, a lighter course page: what it teaches, one way to start
 * and its lessons as a route. "Start the chapter" makes its course the visitor's goal with a plan
 * that starts at this chapter; a chapter whose lessons aren't written yet starts the course.
 */
export async function LibraryChapterPage({
  params,
  route,
}: {
  params: Params;
  route: LibraryChapterRoute;
}) {
  const { chapter, course } = route;
  const [firstLesson] = chapter.lessons;

  const [t, urls] = await Promise.all([
    getExtracted(),
    getChapterUrls({
      ...params,
      chapterId: chapter.id,
      chapterSlug: chapter.slug,
      language: course.language,
    }),
  ]);

  return (
    <PublicPage
      options={
        <ContentVoteMenu
          label={t("Chapter options")}
          screen="chapter"
          size="icon-bar"
          target={{ contentId: chapter.id, contentKind: "chapter" }}
          votes={false}
        />
      }
    >
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

      <CourseStartProvider chapterId={firstLesson ? chapter.id : undefined} courseId={course.id}>
        <section
          aria-labelledby="chapter-title"
          className={cn(HERO_CLASS, "pb-24 sm:pb-32 lg:items-center")}
        >
          <div className="min-w-0">
            <PublicEyebrowLink href={getCourseHref(params)}>{course.title}</PublicEyebrowLink>

            <h1 className={cn(HERO_TITLE_CLASS, "mt-3 sm:mt-4")} id="chapter-title">
              {chapter.title}
            </h1>

            <p className={HERO_LEAD_CLASS}>{chapter.description}</p>

            <PublicStart
              note={
                firstLesson ? (
                  <NoAccountNote>
                    {t("Free to start. No account needed for your first lesson.")}
                  </NoAccountNote>
                ) : (
                  t("Its lessons are written when the first learner starts.")
                )
              }
              start={
                <StartCourseButton
                  label={firstLesson ? t("Start the chapter") : t("Start this course")}
                />
              }
            />

            <ChapterObjectives objectives={chapter.objectives} />
          </div>

          {firstLesson && <ChapterLessonsCard params={params} route={route} />}
        </section>
      </CourseStartProvider>
    </PublicPage>
  );
}
