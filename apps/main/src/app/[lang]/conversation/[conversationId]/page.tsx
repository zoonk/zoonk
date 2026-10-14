import { AuthGateScreen } from "@/components/auth-gate";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { withQuery } from "@/lib/with-query";
import { getLanguageConversation } from "@zoonk/core/language/conversations/get";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ConversationClient } from "./conversation-client";

type Props = PageProps<"/[lang]/conversation/[conversationId]">;

/** A call is one learner's own: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Conversation") };
}

/**
 * The intro's own shape in the task chrome (close, the eyebrow, title and situation, who answers,
 * Start in the bar, and the goals beside them from `lg`), so nothing moves when it arrives.
 */
function ConversationSkeleton() {
  return (
    <TaskSkeleton aside={<Skeleton className="h-32 w-full" />}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-32 w-full lg:hidden" />
    </TaskSkeleton>
  );
}

async function ConversationContent({ params, searchParams }: Props) {
  const [{ conversationId }, query] = await Promise.all([params, searchParams]);

  const result = await getLanguageConversation(conversationId);

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={withQuery(`/conversation/${conversationId}`, query)} />;
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <MainLearnProvider>
      <ConversationClient
        conversation={result.conversation}
        fromExam={query.from === "exam"}
        fromMock={z.uuid().safeParse(query.mock).data ?? null}
      />
    </MainLearnProvider>
  );
}

/**
 * A live conversation, full screen like a lesson: a unit's practice call, a language goal's
 * checkpoint, a speaking mock or an exam's speaking task, from its intro to its feedback.
 * `?from=exam` leads back to the exam screen it was started from, and `?mock=` to the mock whose
 * speaking section it's a task of.
 */
export default function ConversationPage(props: Props) {
  return (
    <Suspense fallback={<ConversationSkeleton />}>
      <ConversationContent {...props} />
    </Suspense>
  );
}
