import {
  COURSE_HERO_CLASS,
  COURSE_TITLE_CLASS,
  HERO_LEAD_CLASS,
  PlanLine,
} from "@/components/catalog/catalog-hero";
import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { CourseExamEyebrow } from "@/components/catalog/course-exam-eyebrow";
import { CourseMark } from "@/components/catalog/course-mark";
import { type CoursePlanExample, getCoursePlanExample } from "@/components/catalog/course-plan";
import { CoursePlanWindow } from "@/components/catalog/course-plan-window";
import { CourseProgressScope } from "@/components/catalog/course-progress";
import {
  TryLesson,
  type TryLessonCandidate,
  type TryLessonPick,
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
import { Page, PageSection } from "@zoonk/learn/page";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale, getContentLocale } from "@zoonk/utils/locale";
import { ArrowRightIcon, LanguagesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { CourseFit } from "./course-fit";
import { CourseStart } from "./course-start";
import { LibraryCourseOutline } from "./library-course-outline";

type Params = { brandSlug: string; courseSlug: string };
type Course = LibraryCourseRoute["course"];

/** Points visitors reading in another language to this course's edition in theirs. */
async function EditionNotice({ courseId, locale }: { courseId: string; locale: SupportedLocale }) {
  const t = await getExtracted();
  const editions = await listPublishedCourseEditions({ courseId });
  const edition = editions.find((item) => getContentLocale(item.language) === locale);

  if (!edition) {
    return null;
  }

  return (
    <Link
      className="bg-muted hover:bg-muted/70 focus-visible:ring-ring/50 mb-6 flex max-w-[560px] gap-3 rounded-xl px-4 py-3 text-sm leading-snug transition-colors outline-none focus-visible:ring-[3px]"
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
 * The course: its mark, an exam course's next sitting, its name, what it makes someone able to
 * do, what Zoonk does with it in one line and the ways in.
 */
function CourseHero({
  course,
  exam,
  isOtherLanguage,
  locale,
  pace,
  promise,
  tryId,
}: {
  course: Course;
  exam: CoursePlanExample["exam"];
  isOtherLanguage: boolean;
  locale: SupportedLocale;
  pace: number | null;
  promise: string | null;
  tryId: string | null;
}) {
  const titleId = `course-title-${course.id}`;

  return (
    <section aria-labelledby={titleId} className="max-w-column flex min-w-0 flex-col">
      {isOtherLanguage && <EditionNotice courseId={course.id} locale={locale} />}

      <CourseMark course={course} loading="eager" locale={locale} />

      {exam && <CourseExamEyebrow exam={exam} />}

      <h1 className={cn(COURSE_TITLE_CLASS, exam ? "mt-2" : "mt-4")} id={titleId}>
        {course.title}
      </h1>

      {promise && <p className={HERO_LEAD_CLASS}>{promise}</p>}

      <PlanLine />

      <CourseStart courseId={course.id} pace={pace} tryId={tryId} />
    </section>
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
 * A lesson to try beside whether the course fits: what it'll make the visitor able to do and who
 * it's for. From `2xl` the question keeps a question's measure (the column, as in the player) and
 * the fit takes the rest of the row; either one alone takes the whole row.
 */
function TryAndFit({
  courseId,
  landingPage,
  locale,
  origin,
  tryId,
  tryLesson,
}: {
  courseId: string;
  landingPage: ReturnType<typeof parseCourseLandingPageContent>;
  locale: SupportedLocale;
  /** The course page's own path, which closing the tried lesson returns to. */
  origin: string;
  tryId: string;
  tryLesson: TryLessonPick | null;
}) {
  const outcomes = landingPage?.outcomes ?? [];
  const audience = landingPage?.audience ?? [];
  const hasFit = outcomes.length > 0 || audience.length > 0;

  if (!tryLesson && !hasFit) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5",
        tryLesson &&
          hasFit &&
          "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start 2xl:grid-cols-[minmax(0,40rem)_minmax(0,1fr)]",
      )}
    >
      {tryLesson && <TryLesson id={tryId} locale={locale} origin={origin} pick={tryLesson} />}
      <CourseFit audience={audience} courseId={courseId} outcomes={outcomes} />
    </div>
  );
}

/** The page's last word, where a long page ends: the one way in again. */
async function CourseClosing({ courseId, pace }: { courseId: string; pace: number | null }) {
  const t = await getExtracted();
  const titleId = `course-closing-${courseId}`;

  return (
    <PageSection aria-labelledby={titleId} className="border-border gap-1 border-t pt-10">
      <h2
        className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-2xl"
        id={titleId}
      >
        {t("Start today, at your level")}
      </h2>

      <p className="text-muted-foreground max-w-[600px] text-[0.9375rem] leading-relaxed text-pretty">
        {t("A few quick questions, then your plan and your first lesson.")}
      </p>

      <CourseStart className="mt-5 sm:mt-6" courseId={courseId} pace={pace} />
    </PageSection>
  );
}

/**
 * A course's page in the catalog, inside the app's frame like Explore courses, written for a
 * visitor from a search who doesn't know Zoonk: the bar back to the catalog; the course and its
 * ways in, beside its example plan, which a time a day turns into weeks to the end (or, for an
 * exam course, into the lessons that fit by the exam), from core's planner; a lesson to try and
 * whether the course fits them; the full outline, every chapter and lesson in the HTML, each
 * chapter marked with its place in the plan at the picked pace; and the way in again. The plan is
 * cached for the hour, so the page's prefetch carries it whole.
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

  const tryId = getTryLessonId(course.id);
  const examDay = plan.exam?.days[0];
  const examDate = examDay ? formatDay(examDay) : null;
  const pace = plan.pace?.minutes ?? null;

  return (
    <CourseProgressScope courseId={course.id} lessonId={tryLesson?.lessonId ?? null}>
      <div className="flex flex-col gap-8">
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

        <Page className="gap-16 sm:gap-20">
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

          <div className={COURSE_HERO_CLASS}>
            <CourseHero
              course={course}
              exam={plan.exam}
              isOtherLanguage={isOtherLanguage}
              locale={locale}
              pace={pace}
              promise={promise}
              tryId={tryLesson ? tryId : null}
            />

            <CoursePlanWindow
              chapterTitles={getChapterTitles(outline)}
              examDate={examDate}
              isExam={course.format === "exam"}
              plan={plan}
            />
          </div>

          <TryAndFit
            courseId={course.id}
            landingPage={landingPage}
            locale={locale}
            origin={getCourseHref(params)}
            tryId={tryId}
            tryLesson={tryLesson}
          />

          <LibraryCourseOutline
            courseId={course.id}
            lead={outlineLead}
            outline={outline}
            params={params}
            plan={{ examDate, pace: plan.pace }}
          />

          <CourseClosing courseId={course.id} pace={pace} />
        </Page>
      </div>
    </CourseProgressScope>
  );
}
