import { AdminCheckDate } from "@/components/admin-check-date";
import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminTableRow } from "@/components/admin-table-row";
import { type ListedExam } from "@/data/exams/list-exams";
import { countryName } from "@/lib/country-name";
import { languageName } from "@/lib/language-filter";
import { FactSegments } from "@zoonk/learn/facts";
import { TableCell } from "@zoonk/ui/components/table";
import { formatExamDate } from "./_utils/format-exam-date";

export function ExamRow({ exam }: { exam: ListedExam }) {
  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/exams/${exam.id}`}
        note={<FactSegments facts={[exam.board, exam.role, languageName(exam.language)]} />}
        title={exam.name}
      />
      <TableCell>{countryName(exam.country)}</TableCell>
      <TableCell className="text-right">{formatExamDate(exam.examDate)}</TableCell>
      <TableCell numeric>{exam._count.goals.toLocaleString("en")}</TableCell>
      <TableCell>
        <AdminCheckDate date={exam.nextCheckAt} kind="next-check" />
      </TableCell>
    </AdminTableRow>
  );
}
