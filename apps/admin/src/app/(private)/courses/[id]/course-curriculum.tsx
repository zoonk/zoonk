import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import {
  type CourseCurriculumChapter,
  getCourseCurriculum,
} from "@/data/courses/get-course-curriculum";
import { libraryLessonStatusLabels } from "@/lib/library-lesson-filters";
import { Badge } from "@zoonk/ui/components/badge";
import Link from "next/link";

type ChapterLessons = CourseCurriculumChapter["chapter"]["lessons"];

/** Where a chapter lives: this course is its home, or it's shared from another course. */
function ChapterHomeLabel({
  chapter,
  courseId,
}: {
  chapter: CourseCurriculumChapter["chapter"];
  courseId: string;
}) {
  const otherCourses = chapter._count.courses - 1;
  const usage = otherCourses > 0 ? ` · also in ${otherCourses} other courses` : "";

  if (chapter.homeCourse?.id === courseId) {
    return <span className="text-muted-foreground text-xs">Home chapter{usage}</span>;
  }

  return (
    <span className="text-xs">
      <Badge variant="outline">Shared</Badge>{" "}
      <span className="text-muted-foreground">
        home: {chapter.homeCourse?.title ?? "none"}
        {usage}
      </span>
    </span>
  );
}

/** A lesson is shared when its home is another chapter or other chapters also use it. */
function ChapterLessonList({ chapterId, lessons }: { chapterId: string; lessons: ChapterLessons }) {
  if (lessons.length === 0) {
    return <p className="text-muted-foreground ml-6 text-xs">No lesson outlines yet.</p>;
  }

  return (
    <ol className="ml-6 flex flex-col gap-1 text-sm">
      {lessons.map(({ lesson, position }) => {
        const isShared = lesson.homeChapterId !== chapterId || lesson._count.chapters > 1;

        return (
          <li className="flex flex-wrap items-center gap-2" key={lesson.id}>
            <span className="text-muted-foreground w-6 tabular-nums">{position + 1}.</span>
            <Link className="hover:underline" href={`/lessons/${lesson.id}`}>
              {lesson.title}
            </Link>
            {isShared ? <Badge variant="outline">Shared lesson</Badge> : null}
            <span className="text-muted-foreground text-xs">
              {libraryLessonStatusLabels[lesson.contentStatus]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One placed chapter: its position in the band, where it lives, and its lessons. */
function CurriculumChapter({
  courseId,
  placement,
}: {
  courseId: string;
  placement: CourseCurriculumChapter;
}) {
  const { chapter, position } = placement;

  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-6 tabular-nums">{position + 1}.</span>
        <span className="font-medium">{chapter.title}</span>
        <ChapterHomeLabel chapter={chapter} courseId={courseId} />
      </div>
      <ChapterLessonList chapterId={chapter.id} lessons={chapter.lessons} />
    </li>
  );
}

/**
 * The curriculum as the Library stores it: chapters by level band and order, marking chapters
 * whose home is another course and lessons shared with other chapters.
 */
export async function CourseCurriculum({ courseId }: { courseId: string }) {
  "use cache: private";

  const placements = await getCourseCurriculum(courseId);
  const levels = Map.groupBy(placements, (placement) => placement.level);

  return (
    <AdminSection
      description="Chapters in level bands, with their home course and shared lessons."
      title="Curriculum"
    >
      {placements.length === 0 ? (
        <AdminSectionEmpty>This course has no Library chapters yet.</AdminSectionEmpty>
      ) : (
        <div className="flex flex-col gap-6">
          {[...levels].map(([level, chapters]) => (
            <section className="flex flex-col gap-3" key={level}>
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {level}
              </h4>
              <ol className="flex flex-col gap-4">
                {chapters.map((placement) => (
                  <CurriculumChapter
                    courseId={courseId}
                    key={placement.chapter.id}
                    placement={placement}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
