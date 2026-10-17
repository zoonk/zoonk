import { type ListedExam } from "@/data/exams/list-exams";
import { formatDate } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { formatExamDate } from "./_utils/format-exam-date";

export function ExamRow({ exam }: { exam: ListedExam }) {
  return (
    <TableRow>
      <TableCell className="max-w-72 min-w-40 whitespace-normal">
        <Link className="font-medium hover:underline" href={`/exams/${exam.id}`} prefetch>
          {exam.name}
        </Link>
      </TableCell>
      <TableCell>{exam.country}</TableCell>
      <TableCell>{exam.board ?? "—"}</TableCell>
      <TableCell>{exam.role ?? "—"}</TableCell>
      <TableCell className="uppercase">{exam.language}</TableCell>
      <TableCell className="tabular-nums">{exam.editionYear ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{formatExamDate(exam.examDate)}</TableCell>
      <TableCell className="text-muted-foreground">
        {formatExamDate(exam.registrationEndsAt)}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(exam.nextCheckAt)}</TableCell>
      <TableCell className="text-right tabular-nums">{exam._count.goals}</TableCell>
      <TableCell className="text-right tabular-nums">{exam._count.items}</TableCell>
    </TableRow>
  );
}
