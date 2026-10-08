import { ClosingCall } from "@/components/public/closing-call";
import { CourseStartProvider } from "@/components/public/course-start-context";
import { JsonLd } from "@/components/public/json-ld";
import { HERO_CLASS, HERO_LEAD_CLASS, HERO_TITLE_CLASS } from "@/components/public/landing-styles";
import { NoAccountNote } from "@/components/public/no-account-note";
import { PUBLIC_CLOSING_START_ID } from "@/components/public/public-ids";
import { PublicPage } from "@/components/public/public-page";
import { PublicStart } from "@/components/public/public-start";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { StartCourseButton } from "@/components/public/start-course-button";
import { type LibraryCourseRoute } from "@/data/catalog/resolve-catalog-route";
import { getCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getLibraryOutlineStats } from "@/lib/public/library-outline";
import { getCourseUrl } from "@/lib/public/public-canonical";
import { getLevelLabel } from "@/lib/public/public-labels";
import { breadcrumbJsonLd, courseJsonLd } from "@/lib/public/structured-data";
import { parseCourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { listPublishedCourseEditions } from "@zoonk/core/courses/published-editions";
import { ContentVoteMenu } from "@zoonk/learn/feedback/vote-menu";
import { LanguageFlag, hasLanguageFlag } from "@zoonk/ui/components/language-flag";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { getLanguageFlagLabel } from "@zoonk/utils/language-flags";
import { type SupportedLocale, getContentLocale } from "@zoonk/utils/locale";
import { ArrowRightIcon, LanguagesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { CourseLevelsCard } from "./course-levels-card";
import { CourseOutcomes } from "./course-outcomes";
import { LibraryCourseOutline } from "./library-course-outline";

type Params = { brandSlug: string; courseSlug: string };

/** Points visitors reading in another language to this course's edition in theirs. */
async function EditionNotice({ courseId, locale }: { courseId: string; locale: SupportedLocale }) {
  const [t, editions] = await Promise.all([
    getExtracted(),
    listPublishedCourseEditions({ courseId }),
  ]);

  const edition = editions.find((item) => getContentLocale(item.language) === locale);

  if (!edition) {
    return null;
  }

  return (
    <Link
      className="bg-muted hover:bg-muted/70 focus-visible:ring-ring/50 mb-6 flex max-w-[560px] gap-3 rounded-2xl px-4 py-3 text-sm leading-snug transition-colors outline-none focus-visible:ring-[3px]"
      href={getCourseHref(edition)}
    >
      <LineMarker>
        <LanguagesIcon aria-hidden="true" className="text-muted-foreground size-4" />
      </LineMarker>
      <span className="flex-1 text-pretty">
        {t("This course is also available in your language.")}
      </span>
      <LineMarker>
        <ArrowRightIcon aria-hidden="true" className="size-4" />
      </LineMarker>
    </Link>
  );
}

/**
 * A course's landing page, in the home page's language: the promise and one way to start, the
 * course at a glance, what it makes you able to do and who it's for, and the outline, whose every
 * chapter and lesson stays in the HTML behind a disclosure. "Start this course" makes the course
 * the visitor's goal on their tap, with a plan built from its outline, and goes straight to what
 * onboarding still needs to ask.
 */
export async function LibraryCoursePage({
  locale,
  params,
  route,
}: {
  locale: SupportedLocale;
  params: Params;
  route: LibraryCourseRoute;
}) {
  const { course, outline } = route;
  const stats = getLibraryOutlineStats(outline);
  const landingPage = parseCourseLandingPageContent(course.landingPage);
  const courseUrl = getCourseUrl({ ...params, language: course.language });
  const isOtherLanguage = getContentLocale(course.language) !== locale;
  const promise = landingPage?.valueProposition || course.description;

  const [t, levelLabels] = await Promise.all([
    getExtracted(),
    Promise.all(outline.levels.map((band) => getLevelLabel(band.level))),
  ]);

  const startLabel = t("Start this course");

  return (
    <PublicPage
      options={
        <ContentVoteMenu
          label={t("Course options")}
          screen="course"
          size="icon-bar"
          target={{ contentId: course.id, contentKind: "course" }}
          votes={false}
        />
      }
    >
      <PublicViewTracker contentId={course.id} page="course" />

      <JsonLd
        items={[
          courseJsonLd({
            description: course.description ?? landingPage?.valueProposition ?? course.title,
            language: course.language,
            levels: levelLabels,
            name: course.title,
            totalMinutes: stats.totalMinutes,
            url: courseUrl,
          }),
          breadcrumbJsonLd([
            { name: t("Courses"), url: getLocalizedUrl({ href: "/courses", language: locale }) },
            { name: course.title, url: courseUrl },
          ]),
        ]}
      />

      <CourseStartProvider courseId={course.id}>
        <section aria-labelledby="course-title" className={cn(HERO_CLASS, "lg:items-center")}>
          <div className="min-w-0">
            {isOtherLanguage && <EditionNotice courseId={course.id} locale={locale} />}

            {hasLanguageFlag(course.targetLanguage) && (
              <LanguageFlag
                alt={
                  getLanguageFlagLabel({ language: course.targetLanguage, userLanguage: locale }) ??
                  ""
                }
                className="mb-5 w-14 sm:mb-6 sm:w-16"
                language={course.targetLanguage}
              />
            )}

            <h1 className={HERO_TITLE_CLASS} id="course-title">
              {course.title}
            </h1>

            {promise && <p className={HERO_LEAD_CLASS}>{promise}</p>}

            <PublicStart
              note={
                <NoAccountNote>
                  {t("Free to start. No account needed for your first lesson.")}
                </NoAccountNote>
              }
              start={<StartCourseButton label={startLabel} />}
            />
          </div>

          {stats.chapterCount > 0 && <CourseLevelsCard outline={outline} />}
        </section>

        <CourseOutcomes
          audience={landingPage?.audience ?? []}
          outcomes={landingPage?.outcomes ?? []}
        />

        <LibraryCourseOutline
          lead={promise === course.description ? null : course.description}
          outline={outline}
          params={params}
        />

        <ClosingCall
          lead={t(
            "Your plan starts at your level and builds from there. Your first lesson comes next.",
          )}
          note={
            <NoAccountNote>
              {t("Free to start. No account needed for your first lesson.")}
            </NoAccountNote>
          }
          title={t("Learn skills you can use, one lesson at a time")}
        >
          <StartCourseButton align="center" id={PUBLIC_CLOSING_START_ID} label={startLabel} />
        </ClosingCall>
      </CourseStartProvider>
    </PublicPage>
  );
}
