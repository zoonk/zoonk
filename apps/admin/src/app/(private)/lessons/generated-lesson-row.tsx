import { type ListedGeneratedLesson } from "@/data/lessons/list-generated-lessons";
import { getAdminLessonKindLabel, getAdminLessonLabel } from "@/lib/lesson-label";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";

/**
 * Generated lesson rows surface the operational fields admins need most:
 * where the lesson belongs, which kind was generated, current terminal status,
 * and how much step content exists.
 */
export function GeneratedLessonRow({ lesson }: { lesson: ListedGeneratedLesson }) {
  const course = lesson.chapter.course;

  return (
    <TableRow>
      <TableCell className="min-w-56 font-medium">
        {getAdminLessonLabel({ kind: lesson.kind, title: lesson.title })}
      </TableCell>
      <TableCell>{getAdminLessonKindLabel(lesson.kind)}</TableCell>
      <TableCell className="min-w-48">{course.title}</TableCell>
      <TableCell className="min-w-48">{lesson.chapter.title}</TableCell>
      <TableCell>{getOrganizationName(lesson)}</TableCell>
      <TableCell>
        <Badge className="capitalize" variant={getGeneratedLessonStatusVariant(lesson)}>
          {lesson.generationStatus}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {lesson._count.steps.toLocaleString()}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(lesson.updatedAt).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );
}

/**
 * The lesson belongs to a course through its chapter. Showing the course
 * organization is the most useful owner label for generated content logs.
 */
function getOrganizationName(lesson: ListedGeneratedLesson): string {
  return lesson.chapter.course.organization?.name ?? "—";
}

/**
 * Failed generated lessons should stand out in the operational log, while the
 * default completed view can stay visually quiet.
 */
function getGeneratedLessonStatusVariant(lesson: ListedGeneratedLesson): "default" | "destructive" {
  return lesson.generationStatus === "failed" ? "destructive" : "default";
}
