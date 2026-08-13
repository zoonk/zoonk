import { type ListedGeneratedLesson } from "@/data/lessons/list-generated-lessons";
import { type GeneratedLessonFilter } from "@/lib/generated-lesson-status";
import { getAdminLessonKindLabel, getAdminLessonLabel } from "@/lib/lesson-label";
import { Badge } from "@zoonk/ui/components/badge";
import { buttonVariants } from "@zoonk/ui/components/button";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { RetryLessonGenerationForm } from "./retry-lesson-generation-form";

/**
 * Generated lesson rows surface the operational fields admins need most:
 * where the lesson belongs, which kind was generated, current operational
 * status, and how much step content exists.
 */
export function GeneratedLessonRow({
  filter,
  lesson,
}: {
  filter: GeneratedLessonFilter;
  lesson: ListedGeneratedLesson;
}) {
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
        <Badge className="capitalize" variant={getGeneratedLessonStatusVariant(filter)}>
          {getGeneratedLessonStatusLabel(filter)}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {lesson._count.steps.toLocaleString()}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(lesson.updatedAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <GeneratedLessonActions filter={filter} lesson={lesson} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Failed rows offer a fresh workflow run in place, while completed language
 * lessons link to the focused surface for repairing missing reusable audio.
 */
function GeneratedLessonActions({
  filter,
  lesson,
}: {
  filter: GeneratedLessonFilter;
  lesson: ListedGeneratedLesson;
}) {
  if (filter === "failed") {
    return <RetryLessonGenerationForm lessonId={lesson.id} />;
  }

  if (lesson.kind === "alphabet" || lesson.kind === "reading" || lesson.kind === "vocabulary") {
    return (
      <Link
        className={buttonVariants({ size: "sm", variant: "outline" })}
        href={`/lessons/${lesson.id}`}
      >
        Review audio
      </Link>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}

/**
 * The lesson belongs to a course through its chapter. Showing the course
 * organization is the most useful owner label for generated content logs.
 */
function getOrganizationName(lesson: ListedGeneratedLesson): string {
  return lesson.chapter.course.organization?.name ?? "—";
}

/**
 * Failed generation and unresolved audio should stand out in the operational
 * log, while the default completed view can stay visually quiet.
 */
function getGeneratedLessonStatusVariant(filter: GeneratedLessonFilter): "default" | "destructive" {
  return filter === "completed" ? "default" : "destructive";
}

/** Missing audio is a completed generation with an unresolved media resource. */
function getGeneratedLessonStatusLabel(filter: GeneratedLessonFilter): string {
  return filter === "missingAudio" ? "Missing audio" : filter;
}
