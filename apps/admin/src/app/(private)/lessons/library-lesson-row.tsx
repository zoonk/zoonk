import { ProvenanceLine } from "@/components/provenance";
import { VoteTotalsLabel } from "@/components/vote-totals";
import { type VoteTotals } from "@/data/feedback/get-vote-totals";
import { type ListedLibraryLesson } from "@/data/lessons/list-library-lessons";
import { formatDate } from "@/lib/format";
import { libraryLessonStatusLabels } from "@/lib/library-lesson-filters";
import { type GenerationStatus } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

function getStatusVariant(status: GenerationStatus) {
  if (status === "failed") {
    return "destructive" as const;
  }

  return status === "completed" ? ("default" as const) : ("outline" as const);
}

/**
 * One Library lesson: where it lives, how far its writing got, the model and prompt version that
 * wrote its screens, and how learners voted on it.
 */
export function LibraryLessonRow({
  lesson,
  votes,
}: {
  lesson: ListedLibraryLesson;
  votes: VoteTotals;
}) {
  const [firstStep] = lesson.steps;

  return (
    <TableRow>
      <TableCell className="min-w-56">
        <Link className="block" href={`/lessons/${lesson.id}`} prefetch>
          <span className="font-medium">{lesson.title}</span>
          <span className="text-muted-foreground block text-xs">
            {lesson.language} · {lesson.level}
            {lesson.visibility === "private" ? " · private" : ""}
          </span>
        </Link>
      </TableCell>
      <TableCell className="min-w-48">
        <span className="block">{lesson.homeChapter?.homeCourse?.title ?? "—"}</span>
        <span className="text-muted-foreground block text-xs">
          {lesson.homeChapter?.title ?? "No home chapter"}
          {lesson._count.chapters > 1 ? ` · in ${lesson._count.chapters} chapters` : ""}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={getStatusVariant(lesson.contentStatus)}>
          {lesson.setAsideAt ? "Set aside" : libraryLessonStatusLabels[lesson.contentStatus]}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{lesson._count.steps}</TableCell>
      <TableCell>
        <ProvenanceLine provenance={firstStep ?? { model: null, promptVersion: null }} />
      </TableCell>
      <TableCell>
        <VoteTotalsLabel totals={votes} />
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(lesson.updatedAt)}</TableCell>
    </TableRow>
  );
}
