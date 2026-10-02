import { VoteTotalsLabel } from "@/components/vote-totals";
import { getVoteTotals, readVoteTotals } from "@/data/feedback/get-vote-totals";
import { type getLessonQuestion } from "@/data/questions/get-lesson-question";
import {
  type AdminQuestionLessonContext,
  getAdminQuestionContextLabel,
  getAdminQuestionLessonContext,
} from "@/lib/lesson-question";
import Link from "next/link";
import { QuestionDetailField } from "./question-detail-field";

type LessonQuestionDetail = NonNullable<Awaited<ReturnType<typeof getLessonQuestion>>>;

function QuestionLessonFields({ context }: { context: AdminQuestionLessonContext | null }) {
  if (!context) {
    return <QuestionDetailField label="Lesson">Deleted lesson</QuestionDetailField>;
  }

  return (
    <>
      <QuestionDetailField label="Course">
        {context.course ? (
          <Link className="hover:underline" href={`/courses/${context.course.id}`} prefetch>
            {context.course.title}
          </Link>
        ) : (
          "—"
        )}
      </QuestionDetailField>
      <QuestionDetailField label="Chapter">{context.chapterTitle ?? "—"}</QuestionDetailField>
      <QuestionDetailField label="Lesson">
        <Link className="hover:underline" href={context.lessonHref} prefetch>
          {context.lessonLabel}
        </Link>
      </QuestionDetailField>
    </>
  );
}

/** Who asked, where, what the tutor model did, and how learners voted on the answer. */
export async function QuestionDetails({ question }: { question: LessonQuestionDetail }) {
  const { user } = question.thread;

  const votes = await getVoteTotals({ contentIds: [question.id], contentKind: "lessonQuestion" });

  return (
    <dl className="divide-y">
      <QuestionDetailField label="User">
        <Link className="hover:underline" href={`/users/${user.id}`} prefetch>
          {user.name || user.username || "User"}
        </Link>
        <span className="text-muted-foreground block">{user.email}</span>
      </QuestionDetailField>
      <QuestionLessonFields context={getAdminQuestionLessonContext(question.thread)} />
      <QuestionDetailField label="Context">
        {getAdminQuestionContextLabel({
          contextKind: question.contextKind,
          stepNumber: question.stepNumber,
        })}
      </QuestionDetailField>
      <QuestionDetailField label="Votes">
        <VoteTotalsLabel totals={readVoteTotals(votes, question.id)} />
      </QuestionDetailField>
      <QuestionDetailField label="Model">
        {question.model ?? question.requestedModel ?? "—"}
      </QuestionDetailField>
      <QuestionDetailField label="Provider">{question.provider ?? "—"}</QuestionDetailField>
      <QuestionDetailField label="Input tokens">
        {question.inputTokens?.toLocaleString() ?? "—"}
      </QuestionDetailField>
      <QuestionDetailField label="Output tokens">
        {question.outputTokens?.toLocaleString() ?? "—"}
      </QuestionDetailField>
      <QuestionDetailField label="Finish reason">
        {question.finishReason ?? "—"}
      </QuestionDetailField>
      <QuestionDetailField label="Updated">
        {question.updatedAt.toLocaleString()}
      </QuestionDetailField>
    </dl>
  );
}
