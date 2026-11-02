import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type ListedExam } from "@/data/exams/list-exams";
import { formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";
import { formatExamDate } from "./_utils/format-exam-date";

export function ExamRow({ exam }: { exam: ListedExam }) {
  return (
    <AdminTableRow>
      <TableCell className="max-w-72 min-w-40 whitespace-normal">
        <AdminTableRowLink className="font-medium" href={`/exams/${exam.id}`} prefetch>
          {exam.name}
        </AdminTableRowLink>
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
    </AdminTableRow>
  );
}
