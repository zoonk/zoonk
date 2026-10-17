import { VoteTotalsLabel } from "@/components/vote-totals";
import { type VoteTotals } from "@/data/feedback/get-vote-totals";
import { type ListedLessonQuestion } from "@/data/questions/list-lesson-questions";
import {
  getAdminQuestionLessonContext,
  getAdminQuestionStatusVariant,
} from "@/lib/lesson-question";
import { Badge } from "@zoonk/ui/components/badge";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

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

export function QuestionRow({
  question,
  votes,
}: {
  question: ListedLessonQuestion;
  votes: VoteTotals;
}) {
  const { user } = question.thread;

  return (
    <TableRow>
      <TableCell className="max-w-72 min-w-56 whitespace-normal">
        <Link
          className="line-clamp-2 font-medium hover:underline"
          href={`/questions/${question.id}`}
          prefetch
        >
          {question.question}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground max-w-80 min-w-64 whitespace-normal">
        <span className="line-clamp-2">{question.answer || "No answer yet"}</span>
      </TableCell>
      <TableCell className="max-w-48 min-w-40">
        <Link className="block hover:underline" href={`/users/${user.id}`} prefetch>
          <span className="block truncate font-medium">{user.name || user.username || "—"}</span>
          <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
        </Link>
      </TableCell>
      <TableCell className="max-w-56 min-w-48 whitespace-normal">
        <QuestionLessonCell question={question} />
      </TableCell>
      <TableCell>
        <VoteTotalsLabel totals={votes} />
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
            {question.createdAt.toLocaleDateString()}
          </time>
        </div>
      </TableCell>
    </TableRow>
  );
}
