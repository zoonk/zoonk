import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { redirect } from "@/i18n/navigation";
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
import { CheckpointCallClient } from "./checkpoint-call-client";
import { CheckpointClient } from "./checkpoint-client";

type Props = PageProps<"/[lang]/checkpoint/[blockId]">;

/** A checkpoint is one learner's own duel: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Challenge") };
}

/**
 * The duel's own shape (its chrome, a question and its options, and the Trickster's aside from
 * `lg`), so nothing moves when it arrives.
 */
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
  // A checkpoint is the learner's own and reads as of today: render per request.
  await connection();
  const [{ blockId, lang }, query] = await Promise.all([params, searchParams]);

  // A language goal's checkpoint is the unit's conversation, played on its own screen. Opening
  // the page never writes the call: a session's preparation writes it ahead, else the learner's
  // tap does.
  const call = await openLanguageCheckpointCall(blockId);

  if (call.status === "earlierFirst") {
    redirect({ href: "/today", locale: lang });
  }

  if (call.status === "ready") {
    redirect({ href: `/conversation/${call.conversationId}`, locale: lang });
  }

  if (call.status === "preparing") {
    return (
      <MainLearnProvider>
        <LearnerWitness />
        <CheckpointCallClient blockId={blockId} unitTitle={call.unitTitle} />
      </MainLearnProvider>
    );
  }

  const result = await getCheckpoint(blockId);

  if (result.status === "unauthorized") {
    return (
      <>
        <LearnerWitness />
        <AuthGateScreen next={withQuery(`/checkpoint/${blockId}`, query)} />
      </>
    );
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnerWitness />
        <TaskNotFound />
      </NotFoundPage>
    );
  }

  const { checkpoint } = result;
  const sessionReturn = getSessionBlockReturn({ query, sessionId: checkpoint.sessionId });

  // Until it starts it's introduced (and started) by its challenge page, which also says where a
  // block that stepped aside stands, and what Plus unlocks for a call the learner's plan leaves to
  // Plus, started before or not.
  if (
    call.status === "plusRequired" ||
    checkpoint.status === "pending" ||
    (checkpoint.status === "skipped" && !checkpoint.endedWithoutQuestions)
  ) {
    if (!checkpoint.planItemId) {
      return (
        <NotFoundPage>
          <LearnerWitness />
          <TaskNotFound />
        </NotFoundPage>
      );
    }

    redirect({ href: `/challenge/${checkpoint.planItemId}${sessionReturn.search}`, locale: lang });
  }

  // An exam's weekly mock runs in real conditions on its own screen.
  if (checkpoint.mock) {
    redirect({ href: `/mock/${blockId}${sessionReturn.search}`, locale: lang });
  }

  return (
    <MainLearnProvider>
      <LearnerWitness />
      <CheckpointClient checkpoint={checkpoint} continueHref={sessionReturn.continueHref} />
    </MainLearnProvider>
  );
}

/**
 * A checkpoint of today's session, full screen like a lesson: the phase checkpoint's duel (the
 * Trickster) or the weekly challenge, and its result. Its intro is its challenge page.
 */
export default function CheckpointPage(props: Props) {
  return (
    <Suspense fallback={<CheckpointSkeleton />}>
      <CheckpointContent {...props} />
    </Suspense>
  );
}
