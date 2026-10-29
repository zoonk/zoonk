import {
  COURSE_HERO_CLASS,
  COURSE_HERO_PAIR_CLASS,
  COURSE_TITLE_CLASS,
  HERO_LEAD_CLASS,
  PlanLine,
} from "@/components/catalog/catalog-hero";
import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { CourseExamEyebrow } from "@/components/catalog/course-exam-eyebrow";
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
import { getIsoDayFormatter, getLevelLabels } from "@/lib/public/public-labels";
import { breadcrumbJsonLd, courseJsonLd } from "@/lib/public/structured-data";
import { getCoursePlanExample } from "@zoonk/core/catalog/course-plan-example";
import { type CoursePlanExample } from "@zoonk/core/catalog/course-plan-example-contract";
import { pickTryLesson } from "@zoonk/core/catalog/try-lesson";
import { parseCourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { listPublishedCourseEditions } from "@zoonk/core/courses/published-editions";
import { ContentFeedbackMenu } from "@zoonk/learn/feedback/content-menu";
import { Page } from "@zoonk/learn/page";
import { Route, RouteMark, RouteStop, RouteTitle } from "@zoonk/learn/route-line";
import { type Subject, getSubject } from "@zoonk/learn/subject-label";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale, getContentLocale } from "@zoonk/utils/locale";
import { ArrowRightIcon, LanguagesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
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
      className="bg-card ring-border hover:bg-muted focus-visible:ring-ring/50 mb-6 flex max-w-[560px] gap-3 rounded-xl px-4 py-3 text-sm leading-snug ring-1 transition-colors outline-none focus-visible:ring-[3px]"
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
        <ArrowRightIcon aria-hidden="true" className="size-4" />
      </LineMarker>
    </Link>
  );
}

function CourseHero({
  course,
  exam,
  isOtherLanguage,
  locale,
  pace,
  promise,
  subject,
  tryId,
}: {
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
    <section aria-labelledby={titleId} className="max-w-column flex min-w-0 flex-col">
      {isOtherLanguage && <EditionNotice courseId={course.id} locale={locale} />}

      <CourseMark course={course} loading="eager" locale={locale} />

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <CourseSubjectLabel subject={subject} />
        {exam && <CourseExamEyebrow exam={exam} />}
      </div>

      <h1 className={cn(COURSE_TITLE_CLASS, "relative mt-3")} id={titleId}>
        <RouteMark down />
        {course.title}
      </h1>

      {promise && <p className={HERO_LEAD_CLASS}>{promise}</p>}

      <PlanLine />

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
      <div className={cn(COURSE_HERO_CLASS, side && COURSE_HERO_PAIR_CLASS)}>
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
          startLinks={t("Start today, at your level")}
        />
      </RouteTitle>

      <CourseGoalSwitch
        continueLink={null}
        startLinks={
          <p className="text-muted-foreground max-w-column text-[0.9375rem] leading-relaxed text-pretty">
            {t("A few quick questions, then your plan and your first lesson.")}
          </p>
        }
      />

      <CourseStart className="mt-5 sm:mt-6" courseId={courseId} pace={pace} />
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
  const formatDay = await getIsoDayFormatter();

  const [tryLesson, plan] = await Promise.all([
    pickTryLesson(outline.levels.flatMap((band) => band.chapters)),
    getCoursePlanExample(course),
  ]);

  const subject = getSubject(course.categories);
  const tryId = getTryLessonId(course.id);
  const examDay = plan.exam?.days[0];
  const examDate = examDay ? formatDay(examDay) : null;
  const pace = plan.pace?.minutes ?? null;

  const planTitleId = `course-plan-${course.id}`;

  const planWindow = (onRoute: boolean) =>
    plan.pace && (
      <CoursePlanWindow
        chapterTitles={getChapterTitles(outline)}
        examDate={examDate}
        isExam={course.format === "exam"}
        onRoute={onRoute}
        plan={plan}
        titleId={planTitleId}
      />
    );

  const tryCard = tryLesson && (
    <TryLesson id={tryId} locale={locale} origin={getCourseHref(params)} pick={tryLesson} />
  );

  return (
    <CourseProgressScope courseId={course.id} lessonId={tryLesson?.lessonId ?? null}>
      <div className="flex flex-col gap-8" data-subject={subject}>
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

        <Page className="gap-0 pt-2 sm:pt-4">
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

            {tryCard && plan.pace && (
              <RouteStop aria-labelledby={planTitleId} className={STOP_CLASS}>
                {planWindow(true)}
              </RouteStop>
            )}

            <CourseFit className={STOP_CLASS} content={landingPage} courseId={course.id} />

            <LibraryCourseOutline
              className={STOP_CLASS}
              courseId={course.id}
              lead={outlineLead}
              outline={outline}
              params={params}
              plan={{ examDate, pace: plan.pace }}
            />

            <CourseClosing courseId={course.id} pace={pace} />
          </Route>
        </Page>
      </div>
    </CourseProgressScope>
  );
}
