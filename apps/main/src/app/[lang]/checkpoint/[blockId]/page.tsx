import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { redirect } from "@/i18n/navigation";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getSessionBlockReturn } from "@/lib/session/session-block-return";
import { withQuery } from "@/lib/with-query";
import { getCheckpoint } from "@zoonk/core/checkpoints/get";
import { openLanguageCheckpointCall } from "@zoonk/core/language/conversations/start";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckpointCallClient, CheckpointCallPreviewClient } from "./checkpoint-call-client";
import { CheckpointClient } from "./checkpoint-client";

type Props = PageProps<"/[lang]/checkpoint/[blockId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Challenge") };
}

function CheckpointSkeleton() {
  return (
    <TaskSkeleton
      aside={
        <>
          <Skeleton className="size-26 rounded-full" />
          <Skeleton className="h-2 w-full rounded-xs" />
          <Skeleton className="h-3 w-3/4" />
        </>
      }
      progress
      title={<Skeleton className="h-4 w-28" />}
    >
      <Skeleton className="h-7 w-5/6" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
      </div>
    </TaskSkeleton>
  );
}

async function CheckpointContent({ params, searchParams }: Props) {
  const [{ blockId, lang }, query] = await Promise.all([params, searchParams]);

  // Its read is cached for the learner's browser, so a link's prefetch draws the call.
  const [call, buddy] = await Promise.all([openLanguageCheckpointCall(blockId), getLearnerBuddy()]);

  if (call.status === "earlierFirst") {
    redirect({ href: "/today", locale: lang });
  }

  if (call.status === "ready") {
    redirect({ href: `/conversation/${call.conversationId}`, locale: lang });
  }

  if (call.status === "notStarted") {
    return (
      <MainLearnProvider>
        <CheckpointCallPreviewClient
          blockId={blockId}
          buddy={buddy}
          dailyLimitReached={call.dailyLimitReached}
          intro={call.intro}
        />
      </MainLearnProvider>
    );
  }

  if (call.status === "preparing") {
    return (
      <MainLearnProvider>
        <CheckpointCallClient blockId={blockId} unitTitle={call.unitTitle} />
      </MainLearnProvider>
    );
  }

  // A duel or the week's challenge is the learner's own and reads as of today: render per request.
  await connection();
  const result = await getCheckpoint(blockId);

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={withQuery(`/checkpoint/${blockId}`, query)} />;
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <TaskNotFound />
      </NotFoundPage>
    );
  }

  const { checkpoint } = result;
  const sessionReturn = getSessionBlockReturn({ query, sessionId: checkpoint.sessionId });

  if (
    call.status === "plusRequired" ||
    checkpoint.status === "pending" ||
    (checkpoint.status === "skipped" && !checkpoint.endedWithoutQuestions)
  ) {
    if (!checkpoint.planItemId) {
      return (
        <NotFoundPage>
          <TaskNotFound />
        </NotFoundPage>
      );
    }

    redirect({ href: `/challenge/${checkpoint.planItemId}${sessionReturn.search}`, locale: lang });
  }

  if (checkpoint.mock) {
    redirect({ href: `/mock/${blockId}${sessionReturn.search}`, locale: lang });
  }

  return (
    <MainLearnProvider>
      <CheckpointClient
        buddy={buddy}
        checkpoint={checkpoint}
        continueHref={sessionReturn.continueHref}
      />
    </MainLearnProvider>
  );
}

export default function CheckpointPage(props: Props) {
  return (
    <Suspense fallback={<CheckpointSkeleton />}>
      <CheckpointContent {...props} />
    </Suspense>
  );
}
