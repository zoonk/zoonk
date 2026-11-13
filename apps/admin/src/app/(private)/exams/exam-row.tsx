import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminTableRow } from "@/components/admin-table-row";
import { StateMark } from "@/components/state-mark";
import { type ListedExam } from "@/data/exams/list-exams";
import { countryName } from "@/lib/country-name";
import { formatDate } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { TableCell } from "@zoonk/ui/components/table";
import { formatExamDate } from "./_utils/format-exam-date";

export function ExamRow({ exam }: { exam: ListedExam }) {
  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/exams/${exam.id}`}
        note={[exam.board, exam.role, languageName(exam.language)].filter(Boolean).join(" · ")}
        title={exam.name}
      />
      <TableCell>{countryName(exam.country)}</TableCell>
      <TableCell>{formatExamDate(exam.examDate)}</TableCell>
      <TableCell numeric>{exam._count.goals.toLocaleString("en")}</TableCell>
      <TableCell>
        {exam.nextCheckAt ? (
          formatDate(exam.nextCheckAt)
        ) : (
          <StateMark state="paused">Not being checked</StateMark>
        )}
      </TableCell>
    </AdminTableRow>
  );
}
