import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getLanguageConversation } from "@zoonk/core/language/conversations/get";
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

function ConversationSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="mx-auto size-20 rounded-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-32 w-full rounded-3xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-full" />
    </main>
  );
}

async function ConversationContent({ params, searchParams }: Props) {
  const [{ conversationId, lang }, query] = await Promise.all([params, searchParams]);

  const result = await getLanguageConversation(conversationId);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
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
