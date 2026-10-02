import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getExperienceMode } from "@/lib/learn/experience-mode";
import { getLanguageConversation } from "@zoonk/core/language/conversations/get";
import { DeviceModeRoot, ModeProvider } from "@zoonk/learn/mode";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConversationClient } from "./conversation-client";

type Props = PageProps<"/[lang]/conversation/[conversationId]">;

/** A call is one learner's own: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Conversation") };
}

function ConversationSkeleton() {
  return (
    <DeviceModeRoot>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="mx-auto size-20 rounded-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="mt-auto h-14 w-full rounded-full" />
      </main>
    </DeviceModeRoot>
  );
}

async function ConversationContent({ params }: Props) {
  const { conversationId, lang } = await params;

  const [result, mode] = await Promise.all([
    getLanguageConversation(conversationId),
    getExperienceMode(),
  ]);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <ModeProvider experienceMode={mode}>
      <MainLearnProvider>
        <ConversationClient conversation={result.conversation} />
      </MainLearnProvider>
    </ModeProvider>
  );
}

/**
 * A live conversation, full screen like a lesson: a unit's practice call, a language goal's
 * checkpoint (the boss in Fun) or a speaking mock, from its intro to its feedback.
 */
export default function ConversationPage(props: Props) {
  return (
    <Suspense fallback={<ConversationSkeleton />}>
      <ConversationContent {...props} />
    </Suspense>
  );
}
