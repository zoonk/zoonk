import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { StateMark } from "@/components/state-mark";
import {
  type CourseCurriculumChapter,
  getCourseCurriculum,
} from "@/data/courses/get-course-curriculum";
import { formatCount } from "@/lib/format";
import { libraryLessonStatusLabels } from "@/lib/library-lesson-filters";
import { Meter, MeterFill } from "@zoonk/ui/components/meter";
import Link from "next/link";

type Chapter = CourseCurriculumChapter["chapter"];

function countWritten(chapters: Chapter[]) {
  const lessons = chapters.flatMap((chapter) => chapter.lessons);

  return {
    total: lessons.length,
    written: lessons.filter(({ lesson }) => lesson.contentStatus === "completed").length,
  };
}

/** Where a chapter that isn't this course's own comes from, and who else uses it. */
function chapterNote({ chapter, courseId }: { chapter: Chapter; courseId: string }): string {
  const others = chapter._count.courses - 1;
  const usage = others > 0 ? `also in ${formatCount(others, "other course")}` : "";

  if (chapter.homeCourse?.id === courseId) {
    return usage;
  }

  const home = `Shared from ${chapter.homeCourse?.title ?? "a deleted course"}`;
  return usage ? `${home}, ${usage}` : home;
}

function ChapterLessons({ chapter }: { chapter: Chapter }) {
  if (chapter.lessons.length === 0) {
    return <p className="text-muted-foreground text-compact">No lessons planned yet.</p>;
  }

  return (
    <ul className="flex flex-col">
      {chapter.lessons.map(({ lesson }) => (
        <li className="flex min-h-11 items-center justify-between gap-4 text-sm" key={lesson.id}>
          <span className="flex min-w-0 items-baseline gap-2">
            <Link
              className="hit-area relative truncate hover:underline"
              href={`/lessons/${lesson.id}`}
            >
              {lesson.title}
            </Link>
            {lesson.homeChapterId !== chapter.id || lesson._count.chapters > 1 ? (
              <span className="text-muted-foreground shrink-0 text-xs">Shared lesson</span>
            ) : null}
          </span>
          <StateMark
            className="text-muted-foreground shrink-0 text-xs"
            state={lesson.contentStatus}
          >
            {libraryLessonStatusLabels[lesson.contentStatus]}
          </StateMark>
        </li>
      ))}
    </ul>
  );
}

function CurriculumChapter({
  courseId,
  number,
  placement,
}: {
  courseId: string;
  number: number;
  placement: CourseCurriculumChapter;
}) {
  const { chapter } = placement;
  const { total, written } = countWritten([chapter]);
  const note = chapterNote({ chapter, courseId });

  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 py-4">
      <span className="text-muted-foreground font-mono text-xs leading-5 tabular-nums">
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="min-w-0">
            <span className="font-medium">{chapter.title}</span>
            {note ? <span className="text-muted-foreground block text-xs">{note}</span> : null}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {written} of {total} written
          </span>
        </div>
        <ChapterLessons chapter={chapter} />
      </div>
    </li>
  );
}

/** A level of the course: how much of it is written, then its chapters and their lessons. */
function CurriculumLevel({
  courseId,
  level,
  placements,
}: {
  courseId: string;
  level: string;
  placements: CourseCurriculumChapter[];
}) {
  const { total, written } = countWritten(placements.map((placement) => placement.chapter));

  return (
    <AdminSection
      description={`${written} of ${formatCount(total, "lesson")} written in ${formatCount(placements.length, "chapter")}`}
      title={`Curriculum: ${level}`}
    >
      <Meter>
        <MeterFill share={total > 0 ? written / total : 0} />
      </Meter>
      <ol className="divide-y">
        {placements.map((placement, index) => (
          <CurriculumChapter
            courseId={courseId}
            key={placement.chapter.id}
            number={index + 1}
            placement={placement}
          />
        ))}
      </ol>
    </AdminSection>
  );
}

export async function CourseCurriculum({ courseId }: { courseId: string }) {
  "use cache: private";

  const placements = await getCourseCurriculum(courseId);
  const levels = Map.groupBy(placements, (placement) => placement.level);

  if (placements.length === 0) {
    return (
      <AdminSection title="Curriculum">
        <AdminSectionEmpty>This course has no chapters yet.</AdminSectionEmpty>
      </AdminSection>
    );
  }

  return [...levels].map(([level, chapters]) => (
    <CurriculumLevel courseId={courseId} key={level} level={level} placements={chapters} />
  ));
}
