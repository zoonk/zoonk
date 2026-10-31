import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { withQuery } from "@/lib/with-query";
import { getLanguageConversation } from "@zoonk/core/language/conversations/get";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { ConversationClient } from "./conversation-client";

type Props = PageProps<"/[lang]/conversation/[conversationId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Conversation") };
}

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

  const [result, buddy] = await Promise.all([
    getLanguageConversation(conversationId),
    getLearnerBuddy(),
  ]);

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={withQuery(`/conversation/${conversationId}`, query)} />;
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
      <ConversationClient
        buddy={buddy}
        conversation={result.conversation}
        fromExam={query.from === "exam"}
        fromMock={z.uuid().safeParse(query.mock).data ?? null}
      />
    </MainLearnProvider>
  );
}

export default function ConversationPage(props: Props) {
  return (
    <Suspense fallback={<ConversationSkeleton />}>
      <ConversationContent {...props} />
    </Suspense>
  );
}
