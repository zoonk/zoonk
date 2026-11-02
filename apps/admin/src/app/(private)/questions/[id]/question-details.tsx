import { DetailField, DetailFields } from "@/components/detail-field";
import { getRunAiUsage } from "@/data/ai/get-run-ai-usage";
import { type getLessonQuestion } from "@/data/questions/get-lesson-question";
import { formatUsd } from "@/lib/ai-format";
import {
  type AdminQuestionLessonContext,
  getAdminQuestionContextLabel,
  getAdminQuestionLessonContext,
} from "@/lib/lesson-question";
import Link from "next/link";

type LessonQuestionDetail = NonNullable<Awaited<ReturnType<typeof getLessonQuestion>>>;

function QuestionLessonFields({ context }: { context: AdminQuestionLessonContext | null }) {
  if (!context) {
    return <DetailField label="Lesson">Deleted lesson</DetailField>;
  }

  return (
    <>
      <DetailField label="Course">
        {context.course ? (
          <Link className="hover:underline" href={`/courses/${context.course.id}`} prefetch>
            {context.course.title}
          </Link>
        ) : (
          "—"
        )}
      </DetailField>
      <DetailField label="Chapter">{context.chapterTitle ?? "—"}</DetailField>
      <DetailField label="Lesson">
        <Link className="hover:underline" href={context.lessonHref} prefetch>
          {context.lessonLabel}
        </Link>
      </DetailField>
    </>
  );
}

export async function QuestionDetails({ question }: { question: LessonQuestionDetail }) {
  const { user } = question.thread;

  const usage = question.runId ? await getRunAiUsage(question.runId) : null;

  return (
    <DetailFields>
      <DetailField label="User">
        <Link className="hover:underline" href={`/users/${user.id}`} prefetch>
          {user.name || user.username || "User"}
        </Link>
        <span className="text-muted-foreground block">{user.email}</span>
      </DetailField>
      <QuestionLessonFields context={getAdminQuestionLessonContext(question.thread)} />
      <DetailField label="Context">
        {getAdminQuestionContextLabel({
          contextKind: question.contextKind,
          stepNumber: question.stepNumber,
        })}
      </DetailField>
      <DetailField label="Model">{question.model ?? question.requestedModel ?? "—"}</DetailField>
      <DetailField label="Provider">{question.provider ?? "—"}</DetailField>
      <DetailField label="Input tokens">{usage?.inputTokens.toLocaleString() ?? "—"}</DetailField>
      <DetailField label="Output tokens">{usage?.outputTokens.toLocaleString() ?? "—"}</DetailField>
      <DetailField label="Cost">
        {usage?.costUsd === null || usage?.costUsd === undefined ? "—" : formatUsd(usage.costUsd)}
      </DetailField>
      <DetailField label="Finish reason">{question.finishReason ?? "—"}</DetailField>
      <DetailField label="Updated">{question.updatedAt.toLocaleString()}</DetailField>
    </DetailFields>
  );
}
