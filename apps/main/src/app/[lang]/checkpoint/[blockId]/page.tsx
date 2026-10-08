import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getSessionBlockReturn } from "@/lib/session/session-block-return";
import { getCheckpoint } from "@zoonk/core/checkpoints/get";
import { openLanguageCheckpointCall } from "@zoonk/core/language/conversations/start";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
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

function CheckpointSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-full" />
    </main>
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

  if (call.status === "ready") {
    redirect({ href: `/conversation/${call.conversationId}`, locale: lang });
  }

  if (call.status === "preparing") {
    return (
      <MainLearnProvider>
        <CheckpointCallClient blockId={blockId} unitTitle={call.unitTitle} />
      </MainLearnProvider>
    );
  }

  const result = await getCheckpoint(blockId);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  const { checkpoint } = result;
  const sessionReturn = getSessionBlockReturn({ query, sessionId: checkpoint.sessionId });

  // Until it starts it's introduced (and started) by its challenge page, which also says where a
  // block that stepped aside stands.
  if (checkpoint.status === "pending" || checkpoint.status === "skipped") {
    if (!checkpoint.planItemId) {
      notFound();
    }

    redirect({ href: `/challenge/${checkpoint.planItemId}${sessionReturn.search}`, locale: lang });
  }

  // An exam's weekly mock runs in real conditions on its own screen.
  if (checkpoint.mock) {
    redirect({ href: `/mock/${blockId}${sessionReturn.search}`, locale: lang });
  }

  return (
    <MainLearnProvider>
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
