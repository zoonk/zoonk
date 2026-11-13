import {
  COURSE_HERO_CLASS,
  COURSE_HERO_PAIR_CLASS,
  COURSE_TITLE_CLASS,
  HERO_LEAD_CLASS,
  PlanLine,
} from "@/components/catalog/catalog-hero";
import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { CourseExamDate } from "@/components/catalog/course-exam-date";
import { CourseMark } from "@/components/catalog/course-mark";
import { CoursePlanWindow } from "@/components/catalog/course-plan-window";
import { CourseGoalSwitch, CourseProgressScope } from "@/components/catalog/course-progress";
import { CourseSubjectLabel } from "@/components/catalog/course-subject-label";
import { TryLesson, getTryLessonId } from "@/components/catalog/try-lesson";
import { JsonLd } from "@/components/public/json-ld";
import { PublicViewTracker } from "@/components/public/public-view-tracker";
import { type LibraryCourseRoute, type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getLibraryOutlineStats } from "@/lib/public/library-outline";
import { getCourseUrl } from "@/lib/public/public-canonical";
import { getLevelLabels } from "@/lib/public/public-labels";
import { breadcrumbJsonLd, courseJsonLd } from "@/lib/public/structured-data";
import { getCoursePlanExample } from "@zoonk/core/catalog/course-plan-example";
import {
  type CoursePlanExample,
  isDatedEstimate,
} from "@zoonk/core/catalog/course-plan-example-contract";
import { pickTryLesson } from "@zoonk/core/catalog/try-lesson";
import { parseCourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { listPublishedCourseEditions } from "@zoonk/core/courses/published-editions";
import { ContentFeedbackMenu } from "@zoonk/learn/feedback/content-menu";
import { Page } from "@zoonk/learn/page";
import { Route, RouteMark, RouteStop, RouteTitle } from "@zoonk/learn/route-line";
import { type Subject, getSubject } from "@zoonk/learn/subject-label";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { PAGE_HEADER_CLASS } from "@zoonk/ui/components/page-header-class";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale, getContentLocale } from "@zoonk/utils/locale";
import { ChevronRightIcon, LanguagesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { ContentCountryLine } from "./content-country-line";
import { CourseFit } from "./course-fit";
import { CourseStart } from "./course-start";
import { LibraryCourseOutline } from "./library-course-outline";

type Params = { brandSlug: string; courseSlug: string };
type Course = LibraryCourseRoute["course"];

const STOP_CLASS = "pb-16 sm:pb-24";

async function EditionNotice({ courseId, locale }: { courseId: string; locale: SupportedLocale }) {
  const t = await getExtracted();
  const editions = await listPublishedCourseEditions({ courseId });
  const edition = editions.find((item) => getContentLocale(item.language) === locale);

  if (!edition) {
    return null;
  }

  return (
    <Link
      className="bg-card ring-border hover:bg-muted focus-visible:ring-ring/50 mb-6 flex min-h-11 max-w-[560px] gap-3 rounded-xl px-4 py-3 text-sm leading-snug ring-1 transition-colors outline-none focus-visible:ring-[3px]"
      href={getCourseHref(edition)}
      prefetch
    >
      <LineMarker>
        <LanguagesIcon aria-hidden="true" className="text-muted-foreground size-4" />
      </LineMarker>
      <span className="flex-1 text-pretty">
        {t("This course is also available in your language.")}
      </span>
      <LineMarker>
        <ChevronRightIcon aria-hidden="true" className="size-4" />
      </LineMarker>
    </Link>
  );
}

function CourseHero({
  contentCountry,
  course,
  exam,
  isOtherLanguage,
  locale,
  pace,
  promise,
  subject,
  tryId,
}: {
  contentCountry: LibraryOutline["contentCountry"];
  course: Course;
  exam: CoursePlanExample["exam"];
  isOtherLanguage: boolean;
  locale: SupportedLocale;
  pace: number | null;
  promise: string | null;
  subject: Subject;
  tryId: string | null;
}) {
  const titleId = `course-title-${course.id}`;

  return (
    <section aria-labelledby={titleId} className={cn(PAGE_HEADER_CLASS, "max-w-column gap-0")}>
      {isOtherLanguage && <EditionNotice courseId={course.id} locale={locale} />}

      <CourseMark course={course} loading="eager" locale={locale} />

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <CourseSubjectLabel subject={subject} />
        {exam && <CourseExamDate exam={exam} />}
      </div>

      <h1 className={cn(COURSE_TITLE_CLASS, "relative mt-3")} id={titleId}>
        <RouteMark down />
        {course.title}
      </h1>

      {promise && <p className={HERO_LEAD_CLASS}>{promise}</p>}

      <ContentCountryLine country={contentCountry} />

      <PlanLine start={exam ? "exam" : "known"} />

      <CourseStart courseId={course.id} pace={pace} tryId={tryId} />
    </section>
  );
}

function CourseFirstScreen({
  hero,
  plan,
  tryCard,
}: {
  hero: ReactNode;
  plan: ReactNode;
  tryCard: ReactNode;
}) {
  const side = tryCard ?? plan;

  return (
    <RouteStop className={STOP_CLASS}>
      <div
        className={cn(
          COURSE_HERO_CLASS,
          side && COURSE_HERO_PAIR_CLASS,
          // Stacked, the plan is the route's next stop: it takes a stop's gap and its mark.
          !tryCard && plan && "gap-16 sm:gap-24",
        )}
      >
        {hero}
        {side}
      </div>
    </RouteStop>
  );
}

function getChapterTitles(outline: LibraryOutline): Map<string, string> {
  return new Map(
    outline.levels.flatMap((band) => band.chapters.map((chapter) => [chapter.id, chapter.title])),
  );
}

async function CourseClosing({ courseId, pace }: { courseId: string; pace: number | null }) {
  const t = await getExtracted();
  const titleId = `course-closing-${courseId}`;

  return (
    <RouteStop aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <RouteTitle id={titleId} station="end">
        <CourseGoalSwitch
          continueLink={t("Your plan follows this course")}
          courseId={courseId}
          startLinks={t({
            description:
              "Heading over the ways to start a plan. “your level” is what the learner already knows.",
            message: "Start today, at your level",
          })}
        />
      </RouteTitle>

      <CourseGoalSwitch
        continueLink={null}
        courseId={courseId}
        startLinks={
          <p className="text-muted-foreground max-w-column text-reading leading-relaxed text-pretty">
            {t("A few quick questions, then your plan and your first lesson.")}
          </p>
        }
      />

      <CourseStart className="mt-5 sm:mt-6" courseId={courseId} pace={pace} pricing />
    </RouteStop>
  );
}

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
  const outlineLead = promise === course.description ? null : course.description;

  const t = await getExtracted();
  const levelLabels = await getLevelLabels();

  const [tryLesson, plan] = await Promise.all([
    pickTryLesson(outline.levels.flatMap((band) => band.chapters)),
    getCoursePlanExample(course),
  ]);

  const subject = getSubject(course.categories);
  const tryId = getTryLessonId(course.id);
  const pace = plan.pace?.minutes ?? null;
  const estimate = plan.pace?.estimate;
  const weeks = estimate && !isDatedEstimate(estimate) ? estimate : null;
  const areas = estimate && isDatedEstimate(estimate) ? estimate : null;

  const planTitleId = `course-plan-${course.id}`;

  const planWindow = (onRoute: boolean) =>
    weeks &&
    pace && (
      <CoursePlanWindow
        chapterTitles={getChapterTitles(outline)}
        estimate={weeks}
        minutes={pace}
        onRoute={onRoute}
        titleId={planTitleId}
      />
    );

  const tryCard = tryLesson && (
    <TryLesson id={tryId} locale={locale} origin={getCourseHref(params)} pick={tryLesson} />
  );

  return (
    <CourseProgressScope courseId={course.id} lessonId={tryLesson?.lessonId ?? null}>
      <div className="flex flex-col" data-subject={subject}>
        <CatalogPageBar
          back={{ href: "/courses", label: t("Explore courses") }}
          options={
            <ContentFeedbackMenu
              label={t("Course options")}
              screen="course"
              size="icon-bar"
              target={{ contentId: course.id, contentKind: "course" }}
            />
          }
          title={course.title}
        />

        <Page className="gap-0">
          <PublicViewTracker contentId={course.id} page="course" />

          <JsonLd
            items={[
              courseJsonLd({
                description: course.description ?? landingPage?.valueProposition ?? course.title,
                language: course.language,
                levels: outline.levels.map((band) => levelLabels[band.level]),
                name: course.title,
                totalMinutes: stats.totalMinutes,
                url: courseUrl,
              }),
              breadcrumbJsonLd([
                {
                  name: t("Courses"),
                  url: getLocalizedUrl({ href: "/courses", language: locale }),
                },
                { name: course.title, url: courseUrl },
              ]),
            ]}
          />

          <Route>
            <CourseFirstScreen
              hero={
                <CourseHero
                  contentCountry={outline.contentCountry}
                  course={course}
                  exam={plan.exam}
                  isOtherLanguage={isOtherLanguage}
                  locale={locale}
                  pace={pace}
                  promise={promise}
                  subject={subject}
                  tryId={tryLesson ? tryId : null}
                />
              }
              plan={planWindow(false)}
              tryCard={tryCard}
            />

            {tryCard && weeks && (
              <RouteStop aria-labelledby={planTitleId} className={STOP_CLASS}>
                {planWindow(true)}
              </RouteStop>
            )}

            <CourseFit className={STOP_CLASS} content={landingPage} courseId={course.id} />

            <LibraryCourseOutline
              className={STOP_CLASS}
              courseFormat={course.format}
              courseId={course.id}
              lead={outlineLead}
              outline={outline}
              params={params}
              areas={areas}
            />

            <CourseClosing courseId={course.id} pace={pace} />
          </Route>
        </Page>
      </div>
    </CourseProgressScope>
  );
}
