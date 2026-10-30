import { AdminAnswerMarkdown } from "@/components/admin-answer-markdown";
import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionSkeleton } from "@/components/admin-section";
import { getLessonQuestion } from "@/data/questions/get-lesson-question";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuestionDetails } from "./question-details";

export const metadata: Metadata = { title: "Question" };

const QUESTION_PARENTS = [{ href: "/questions", label: "Questions" }];

const QUESTION_STATUS_LABELS = {
  completed: "Completed",
  failed: "Failed",
  pending: "Pending",
  running: "Running",
} as const;

export default function QuestionDetailPage({ params }: PageProps<"/questions/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<QuestionDetailSkeleton />}>
        <QuestionDetailContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function QuestionDetailContent({ params }: Pick<PageProps<"/questions/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const question = await getLessonQuestion(id);

  if (!question) {
    notFound();
  }

  const { user } = question.thread;
  const failed = question.status === "failed";

  return (
    <>
      <AdminDetailHeader
        alert={failed ? QUESTION_STATUS_LABELS.failed : null}
        facts={[
          !failed && QUESTION_STATUS_LABELS[question.status],
          user.name || user.username || user.email,
          `Asked ${formatDateTime(question.createdAt)}`,
        ]}
        parents={QUESTION_PARENTS}
        title={question.question}
      />

      <AdminDetailBody>
        <AdminSection title="Answer">
          <div className="max-w-3xl leading-7">
            {question.answer ? (
              <AdminAnswerMarkdown answer={question.answer} />
            ) : (
              <p>No answer is available yet.</p>
            )}
          </div>
        </AdminSection>

        <AdminSection title="Details">
          <QuestionDetails question={question} />
        </AdminSection>
      </AdminDetailBody>
    </>
  );
}

function QuestionDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={QUESTION_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton>
          <div className="flex max-w-3xl flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </AdminSectionSkeleton>
        <AdminSectionSkeleton rows={11} />
      </AdminDetailBody>
    </>
  );
}
