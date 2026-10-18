import { VoteTotalsLabel } from "@/components/vote-totals";
import { getRunAiUsage } from "@/data/ai/get-run-ai-usage";
import { getVoteTotals, readVoteTotals } from "@/data/feedback/get-vote-totals";
import { type getLessonQuestion } from "@/data/questions/get-lesson-question";
import { formatUsd } from "@/lib/ai-format";
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

  const [votes, usage] = await Promise.all([
    getVoteTotals({ contentIds: [question.id], contentKind: "lessonQuestion" }),
    question.runId ? getRunAiUsage(question.runId) : null,
  ]);

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
        {usage?.inputTokens.toLocaleString() ?? "—"}
      </QuestionDetailField>
      <QuestionDetailField label="Output tokens">
        {usage?.outputTokens.toLocaleString() ?? "—"}
      </QuestionDetailField>
      <QuestionDetailField label="Cost">
        {usage?.costUsd === null || usage?.costUsd === undefined ? "—" : formatUsd(usage.costUsd)}
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
