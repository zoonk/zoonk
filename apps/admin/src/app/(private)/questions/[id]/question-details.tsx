import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getRunAiUsage } from "@/data/ai/get-run-ai-usage";
import { type getLessonQuestion } from "@/data/questions/get-lesson-question";
import { formatUsd } from "@/lib/ai-format";
import { formatDateTime } from "@/lib/format";
import { getAdminQuestionContextLabel, getAdminQuestionLessonContext } from "@/lib/lesson-question";
import Link from "next/link";

type LessonQuestionDetail = NonNullable<Awaited<ReturnType<typeof getLessonQuestion>>>;

const LINK_CLASS = "hit-area relative underline underline-offset-3";

/** Where the learner was when they asked, and who they are. */
export function QuestionAskedIn({ question }: { question: LessonQuestionDetail }) {
  const { user } = question.thread;
  const context = getAdminQuestionLessonContext(question.thread);

  return (
    <AdminSection title="Asked in">
      <DetailFields>
        <DetailField label="Lesson">
          {context ? (
            <Link className={LINK_CLASS} href={context.lessonHref} prefetch>
              {context.lessonLabel}
            </Link>
          ) : (
            "It was removed."
          )}
        </DetailField>
        <DetailField label="Where">
          {getAdminQuestionContextLabel({
            contextKind: question.contextKind,
            stepNumber: question.stepNumber,
          })}
        </DetailField>
        {context?.chapterTitle ? (
          <DetailField label="Chapter">{context.chapterTitle}</DetailField>
        ) : null}
        {context?.course ? (
          <DetailField label="Course">
            <Link className={LINK_CLASS} href={`/courses/${context.course.id}`} prefetch>
              {context.course.title}
            </Link>
          </DetailField>
        ) : null}
        <DetailField label="Asked by">
          <Link className={LINK_CLASS} href={`/users/${user.id}`} prefetch>
            {user.name || user.username || "No name"}
          </Link>
          <span className="text-muted-foreground block text-xs">{user.email}</span>
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}

/** Which model answered and what the answer cost. */
export async function QuestionWrittenBy({ question }: { question: LessonQuestionDetail }) {
  const usage = question.runId ? await getRunAiUsage(question.runId) : null;

  return (
    <AdminSection title="Written by">
      <DetailFields>
        <DetailField label="Model">{question.model ?? question.requestedModel}</DetailField>
        <DetailField label="Provider">{question.provider}</DetailField>
        <DetailField label="Input tokens">{usage?.inputTokens.toLocaleString("en")}</DetailField>
        <DetailField label="Output tokens">{usage?.outputTokens.toLocaleString("en")}</DetailField>
        <DetailField label="Cost">
          {usage?.costUsd === null || usage?.costUsd === undefined
            ? null
            : formatUsd(usage.costUsd)}
        </DetailField>
        <DetailField label="Finish reason">{question.finishReason}</DetailField>
        <DetailField label="Updated" mono={false}>
          {formatDateTime(question.updatedAt)}
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}
