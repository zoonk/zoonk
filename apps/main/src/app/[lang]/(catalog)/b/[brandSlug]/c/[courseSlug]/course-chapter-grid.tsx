import { CourseLevelLabel } from "@/components/courses/course-level-label";
import { CourseLevelSelect } from "@/components/courses/course-level-select";
import { getCoursePath } from "@/data/courses/get-course-path";
import { getCurriculumGenerationView } from "@/data/courses/get-curriculum-generation-view";
import { Link } from "@/i18n/navigation";
import { getDefaultChapterImage } from "@/lib/catalog/default-images";
import { type CourseChapter, listCourseChapters } from "@zoonk/core/chapters/list-by-course";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { OPTIONAL_LESSON_KINDS } from "@zoonk/core/courses/learning-plan-contract";
import { type CourseLevel } from "@zoonk/db";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { ChapterList } from "./chapter-list";

type LearningPath = Awaited<ReturnType<typeof getCoursePath>>;

function getSelectedChapters({
  chapters,
  path,
}: {
  chapters: CourseChapter[];
  path: LearningPath;
}) {
  if (path.status !== "ready") {
    return { currentLevel: null, selectedChapters: [] };
  }

  const currentLevel =
    path.chapters.find((chapter) => chapter.id === path.nextTarget?.chapterId)?.level ??
    path.chapters[0]?.level ??
    null;

  const selected = path.chapters.filter(
    (chapter) => path.plan?.depth === "focused" || !currentLevel || chapter.level === currentLevel,
  );

  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  return {
    currentLevel,
    selectedChapters: selected.flatMap((chapter) => chaptersById.get(chapter.id) ?? []),
  };
}

async function CourseGridHeading({
  currentLevel,
  isFocused,
  showFull,
}: {
  currentLevel: CourseLevel | null;
  isFocused: boolean;
  showFull: boolean;
}) {
  const t = await getExtracted();

  if (showFull) {
    return t("Full course");
  }

  if (isFocused) {
    return t("Your learning path");
  }

  if (currentLevel) {
    return <CourseLevelLabel level={currentLevel} />;
  }

  return t("Chapters");
}

async function CourseGridEmpty({
  brandSlug,
  canPrepare,
  courseId,
  courseSlug,
  invalidPath,
}: {
  brandSlug: string;
  canPrepare: boolean;
  courseId: string;
  courseSlug: string;
  invalidPath: boolean;
}) {
  const t = await getExtracted();

  if (invalidPath) {
    return (
      <div className="flex flex-col gap-3 py-8">
        <p className="text-muted-foreground text-sm">
          {t("Your choices need an update before we can show your path.")}
        </p>
        <Link
          className="text-sm underline underline-offset-4"
          href={`/b/${brandSlug}/c/${courseSlug}/start`}
        >
          {t("Update learning path")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-8">
      <p className="text-muted-foreground text-sm">
        {t("Your chapters will appear here when your course is ready.")}
      </p>
      {canPrepare && (
        <Link
          className="text-sm underline underline-offset-4"
          href={`/generate/curriculum/${courseId}`}
        >
          {t("Prepare course")}
        </Link>
      )}
    </div>
  );
}

async function CourseChapterToolbar({
  brandSlug,
  courseSlug,
  currentLevel,
  hasPlan,
  isFocused,
  levels,
  selectedLevel,
  showFull,
}: {
  brandSlug: string;
  courseSlug: string;
  currentLevel: CourseLevel | null;
  hasPlan: boolean;
  isFocused: boolean;
  levels: CourseLevel[];
  selectedLevel: CourseLevel | "all";
  showFull: boolean;
}) {
  const t = await getExtracted();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">
        <CourseGridHeading currentLevel={currentLevel} isFocused={isFocused} showFull={showFull} />
      </h2>
      {showFull && levels.length > 1 ? (
        <CourseLevelSelect
          brandSlug={brandSlug}
          courseSlug={courseSlug}
          levels={levels}
          selected={selectedLevel}
        />
      ) : null}
      {!showFull && levels.length > 0 && (
        <Link
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          href={`/b/${brandSlug}/c/${courseSlug}?edition=original&curriculum=full`}
        >
          {t("View full course")}
        </Link>
      )}
      {showFull && (
        <Link
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          href={`/b/${brandSlug}/c/${courseSlug}?edition=original`}
        >
          {hasPlan ? t("Back to your path") : t("Back to course")}
        </Link>
      )}
    </div>
  );
}

function CoursePathSummary({
  language,
  path,
  showFull,
}: {
  language: string;
  path: LearningPath;
  showFull: boolean;
}) {
  if (showFull || path.status !== "ready" || path.plan?.depth !== "focused" || !path.plan.summary) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm" lang={language}>
      {path.plan.summary}
    </p>
  );
}

export async function CourseChapterGrid({
  params,
  searchParams,
}: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">) {
  const { brandSlug, courseSlug } = await params;

  const [course, query] = await Promise.all([getCourse({ brandSlug, courseSlug }), searchParams]);

  if (!course) {
    notFound();
  }

  const [chapters, path] = await Promise.all([
    listCourseChapters({ courseId: course.id }),
    getCoursePath(course.id),
  ]);

  const showFull = query.curriculum === "full";

  const levels = [
    ...new Set(chapters.flatMap((chapter) => (chapter.level ? [chapter.level] : []))),
  ];

  const selectedLevel = levels.find((level) => level === query.level) ?? "all";
  const { currentLevel, selectedChapters } = getSelectedChapters({ chapters, path });

  const displayed = showFull
    ? chapters.filter((chapter) => selectedLevel === "all" || chapter.level === selectedLevel)
    : selectedChapters;

  const hiddenLessonKinds = [
    ...new Set([
      ...(!showFull && path.status === "ready" ? (path.plan?.hiddenLessonKinds ?? []) : []),
      ...OPTIONAL_LESSON_KINDS,
    ]),
  ];

  const isFocused = path.status === "ready" && path.plan?.depth === "focused";
  const generation = chapters.length === 0 ? await getCurriculumGenerationView(course.id) : null;

  const canPrepare =
    generation?.status === "unauthorized" ||
    (generation?.status === "ready" && generation.needsGeneration);

  return (
    <div className="flex flex-col gap-5">
      <CourseChapterToolbar
        brandSlug={brandSlug}
        courseSlug={courseSlug}
        currentLevel={currentLevel}
        hasPlan={path.status === "ready" && path.plan !== null}
        isFocused={isFocused}
        levels={levels}
        selectedLevel={selectedLevel}
        showFull={showFull}
      />
      <CoursePathSummary language={course.language} path={path} showFull={showFull} />
      {displayed.length > 0 ? (
        <ChapterList
          brandSlug={brandSlug}
          chapters={displayed}
          courseId={course.id}
          courseSlug={courseSlug}
          defaultChapterImage={getDefaultChapterImage({ categories: course.categories })}
          hiddenLessonKinds={hiddenLessonKinds}
          view={showFull ? "curriculum" : "path"}
        />
      ) : (
        <CourseGridEmpty
          brandSlug={brandSlug}
          canPrepare={canPrepare}
          courseId={course.id}
          courseSlug={courseSlug}
          invalidPath={path.status === "invalid"}
        />
      )}
    </div>
  );
}
