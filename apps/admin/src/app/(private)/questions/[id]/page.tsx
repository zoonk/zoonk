import { AdminAnswerMarkdown } from "@/components/admin-answer-markdown";
import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionEmpty, AdminSectionSkeleton } from "@/components/admin-section";
import { AdminRecordTabs, readAdminTab } from "@/components/admin-tabs";
import { getLessonQuestion } from "@/data/questions/get-lesson-question";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuestionAskedIn, QuestionWrittenBy } from "./question-details";

export async function generateMetadata({
  params,
}: PageProps<"/questions/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getLessonQuestion(id);

  if (!record) {
    notFound();
  }

  return { title: record.question };
}

const QUESTION_PARENTS = [{ href: "/questions", label: "Buddy questions" }];

const QUESTION_TABS = [
  { label: "Answer", value: "answer" },
  { label: "Written by", value: "written" },
] as const;

/** An answered question needs no state; one that failed or isn't written yet says so. */
const UNANSWERED_LABELS = {
  failed: "The answer failed",
  pending: "Waiting for its answer",
  running: "Being answered",
} as const;

export default function QuestionDetailPage({ params, searchParams }: PageProps<"/questions/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<QuestionDetailSkeleton />}>
        <QuestionDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function QuestionDetailContent({ params, searchParams }: PageProps<"/questions/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (!isUuid(id)) {
    notFound();
  }

  const question = await getLessonQuestion(id);

  if (!question) {
    notFound();
  }

  const { user } = question.thread;
  const tab = readAdminTab({ tabs: QUESTION_TABS, value: query.tab });

  return (
    <>
      <AdminDetailHeader
        alert={question.status === "failed" ? UNANSWERED_LABELS.failed : null}
        facts={[
          question.status !== "completed" &&
            question.status !== "failed" &&
            UNANSWERED_LABELS[question.status],
          user.name || user.username || user.email,
          `Asked ${formatDateTime(question.createdAt)}`,
        ]}
        parents={QUESTION_PARENTS}
        title={question.question}
        titleClassName="max-w-3xl"
      />

      <AdminDetailBody>
        <AdminRecordTabs
          current={tab}
          label="Buddy question"
          path={`/questions/${question.id}`}
          tabs={QUESTION_TABS}
        />

        {tab === "answer" ? (
          <AdminDetailColumns aside={<QuestionAskedIn question={question} />}>
            <AdminSection title="The buddy answered">
              {question.answer ? (
                <div className="flex max-w-2xl flex-col gap-3 text-sm leading-6">
                  <AdminAnswerMarkdown answer={question.answer} />
                </div>
              ) : (
                <AdminSectionEmpty>No answer yet.</AdminSectionEmpty>
              )}
            </AdminSection>
          </AdminDetailColumns>
        ) : null}

        {tab === "written" ? <QuestionWrittenBy question={question} /> : null}
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
      </AdminDetailBody>
    </>
  );
}
