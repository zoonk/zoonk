import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { getWritingAttempt } from "@zoonk/core/exams/essays/get-writing-attempt";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { WritingAnswerScreen } from "@zoonk/learn/writing/answer";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

type Props = PageProps<"/[lang]/essay/answers/[attemptId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Your answer") };
}

async function AnswerContent({ params }: Props) {
  const { attemptId } = await params;
  const result = await getWritingAttempt(attemptId);

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={`/essay/answers/${attemptId}`} />;
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <TaskNotFound />
      </NotFoundPage>
    );
  }

  return (
    <MainLearnProvider>
      <WritingAnswerScreen answer={result.attempt} exitHref="/plan" />
    </MainLearnProvider>
  );
}

export default function AnswerPage(props: Props) {
  return (
    <Suspense
      fallback={
        <TaskSkeleton title={<Skeleton className="h-4 w-40" />}>
          <Skeleton className="h-24 w-full" />
        </TaskSkeleton>
      }
    >
      <AnswerContent {...props} />
    </Suspense>
  );
}
