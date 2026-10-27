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
import { type CoursePlanExample, getCoursePlanExample } from "@/components/catalog/course-plan";
import { CoursePlanWindow } from "@/components/catalog/course-plan-window";
import { CourseGoalSwitch, CourseProgressScope } from "@/components/catalog/course-progress";
import { CourseSubjectLabel } from "@/components/catalog/course-subject-label";
import {
  TryLesson,
  type TryLessonCandidate,
  getTryLessonId,
  pickTryLesson,
} from "@/components/catalog/try-lesson";
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
import { parseCourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { listPublishedCourseEditions } from "@zoonk/core/courses/published-editions";
import { ContentVoteMenu } from "@zoonk/learn/feedback/vote-menu";
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

/** The room between the route's stops, inside each one, so the line runs on unbroken. */
const STOP_CLASS = "pb-16 sm:pb-24";

/**
 * Points visitors reading in another language to this course's edition in theirs, on a panel over
 * the first screen's band.
 */
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

/**
 * The course: its mark, its subject (and an exam course's next sitting) over its name, the first
 * station of its route, what it makes someone able to do, what Zoonk does with it in one line and
 * the ways in.
 */
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

/**
 * The first screen, the route's first stop: the course and its ways in, beside the course's own
 * first question to try (off the line, beside the title from `xl`), so the page teaches before it
 * explains, with the example plan as the next stop; without a question, the plan takes its place
 * beside the course.
 */
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

/** The course's chapters by id, for the plan's rows to say which chapter a lesson is from. */
function getChapterTitles(outline: LibraryOutline): Map<string, string> {
  return new Map(
    outline.levels.flatMap((band) => band.chapters.map((chapter) => [chapter.id, chapter.title])),
  );
}

/** The course's first lessons in order, with their chapters and their numbers there. */
function getTryCandidates(outline: LibraryOutline): TryLessonCandidate[] {
  return outline.levels.flatMap((band) =>
    band.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson, index) => ({
        chapterTitle: chapter.title,
        lessonId: lesson.id,
        number: index + 1,
      })),
    ),
  );
}

/**
 * The page's last word, where its route ends: the one way in again. A learner whose goal already
 * follows the course is past the start, so the end says so above "Continue your plan" instead of
 * promising them the first questions again.
 */
async function CourseClosing({ courseId, pace }: { courseId: string; pace: number | null }) {
  const t = await getExtracted();
  const titleId = `course-closing-${courseId}`;

  return (
    <RouteStop aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <RouteTitle id={titleId} station="end" up>
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

/**
 * A course's page in the catalog, inside the app's frame like Explore courses, written for a
 * visitor from a search who doesn't know Zoonk: the bar back to the catalog; the course and its
 * ways in, beside the course's own first question, answerable right there, so the page starts
 * teaching before it explains anything; its example plan, which a time a day turns into weeks to
 * the end (or, for an exam course, into the lessons that fit by the exam), from core's planner,
 * beside the course instead when there's no question to try; who it's for and what it makes them
 * able to do; the full outline, every chapter and lesson in the HTML, each chapter marked with its
 * place in the plan at the example's pace; and the way in again. The plan is cached for the hour,
 * so the page's prefetch carries it whole.
 * "Build my plan" opens the course's start page, which asks their level and starts the plan on
 * their tap there.
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
  const outlineLead = promise === course.description ? null : course.description;

  const t = await getExtracted();
  const levelLabels = await getLevelLabels();
  const formatDay = await getIsoDayFormatter();

  const [tryLesson, plan] = await Promise.all([
    pickTryLesson(getTryCandidates(outline)),
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
            <ContentVoteMenu
              label={t("Course options")}
              screen="course"
              size="icon-bar"
              target={{ contentId: course.id, contentKind: "course" }}
              votes={false}
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
