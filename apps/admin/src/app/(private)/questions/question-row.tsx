import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminTableRow } from "@/components/admin-table-row";
import { AdminUserCell } from "@/components/admin-user-cell";
import { StateMark } from "@/components/state-mark";
import { type ListedLessonQuestion } from "@/data/questions/list-lesson-questions";
import { formatDate } from "@/lib/format";
import { getAdminQuestionLessonContext } from "@/lib/lesson-question";
import { TableCell } from "@zoonk/ui/components/table";
import { markdownToPlainText } from "@zoonk/utils/markdown-text";

/** The course over the lesson the question was asked in. */
function QuestionLessonCell({ question }: { question: ListedLessonQuestion }) {
  const context = getAdminQuestionLessonContext(question.thread);

  if (!context) {
    return <span className="text-faint">Lesson removed</span>;
  }

  return (
    <>
      <span className="text-foreground block truncate">
        {context.course?.title ?? context.lessonLabel}
      </span>
      {context.course ? (
        <span className="block truncate text-xs">{context.lessonLabel}</span>
      ) : null}
    </>
  );
}

/** An answered question shows only its date; one that failed or is still being written says so. */
function QuestionAskedCell({ question }: { question: ListedLessonQuestion }) {
  return (
    <>
      {formatDate(question.createdAt)}
      {question.status === "completed" ? null : (
        <StateMark className="block text-xs" state={question.status} />
      )}
    </>
  );
}

export function QuestionRow({ question }: { question: ListedLessonQuestion }) {
  const { user } = question.thread;

  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/questions/${question.id}`}
        note={question.answer ? markdownToPlainText(question.answer) : "No answer yet"}
        title={question.question}
      />
      <AdminUserCell opensRow={false} user={user} userId={user.id} />
      <TableCell>
        <QuestionLessonCell question={question} />
      </TableCell>
      <TableCell>
        <QuestionAskedCell question={question} />
      </TableCell>
    </AdminTableRow>
  );
}
