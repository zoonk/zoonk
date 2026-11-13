import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { AdminUserCell } from "@/components/admin-user-cell";
import { type ListedLessonQuestion } from "@/data/questions/list-lesson-questions";
import { formatDate } from "@/lib/format";
import {
  getAdminQuestionLessonContext,
  getAdminQuestionStatusVariant,
} from "@/lib/lesson-question";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell } from "@zoonk/ui/components/table";
import { markdownToPlainText } from "@zoonk/utils/markdown-text";

function QuestionLessonCell({ question }: { question: ListedLessonQuestion }) {
  const context = getAdminQuestionLessonContext(question.thread);

  if (!context) {
    return <span className="text-muted-foreground">Deleted lesson</span>;
  }

  return (
    <>
      <span className="line-clamp-1 font-medium">{context.course?.title ?? "—"}</span>
      <span className="text-muted-foreground line-clamp-1 text-xs">
        {[context.chapterTitle, context.lessonLabel].filter(Boolean).join(" · ")}
      </span>
    </>
  );
}

export function QuestionRow({ question }: { question: ListedLessonQuestion }) {
  const { user } = question.thread;

  return (
    <AdminTableRow>
      <TableCell className="max-w-72 min-w-56 whitespace-normal">
        <AdminTableRowLink className="font-medium" href={`/questions/${question.id}`} prefetch>
          <span className="line-clamp-2">{question.question}</span>
        </AdminTableRowLink>
      </TableCell>
      <TableCell className="text-muted-foreground max-w-80 min-w-64 whitespace-normal">
        <span className="line-clamp-2">
          {question.answer ? markdownToPlainText(question.answer) : "No answer yet"}
        </span>
      </TableCell>
      <AdminUserCell opensRow={false} user={user} userId={user.id} />
      <TableCell className="max-w-56 min-w-48 whitespace-normal">
        <QuestionLessonCell question={question} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <Badge className="capitalize" variant={getAdminQuestionStatusVariant(question.status)}>
            {question.status}
          </Badge>
          <time
            className="text-muted-foreground text-xs"
            dateTime={question.createdAt.toISOString()}
          >
            {formatDate(question.createdAt)}
          </time>
        </div>
      </TableCell>
    </AdminTableRow>
  );
}
