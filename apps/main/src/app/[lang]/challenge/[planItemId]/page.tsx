import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { getChallenge } from "@zoonk/core/checkpoints/challenge";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChallengeClient } from "./challenge-client";
import { MOVED_PARAM } from "./challenge-params";

type Props = PageProps<"/[lang]/challenge/[planItemId]">;

/** A challenge is one learner's own: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Challenge") };
}

function ChallengeSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="mt-auto h-14 w-full rounded-full" />
    </main>
  );
}

type Query = Record<string, string | string[] | undefined>;

function readParam(query: Query, name: string): string | null {
  const value = query[name];
  return typeof value === "string" ? value : null;
}

async function ChallengeContent({ params, searchParams }: Props) {
  // Where a challenge stands is the learner's own and changes with the day: render per request.
  await connection();
  const [{ lang, planItemId }, query] = await Promise.all([params, searchParams]);
  const result = await getChallenge({ input: {}, planItemId });

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  const { challenge } = result;
  // Today's session opened it (`?session=`): its block continues back to the session.
  const sessionId = readParam(query, STUDY_SESSION_PARAM);

  // A language goal's checkpoint is the unit's call, which its own screen opens on its day.
  if (challenge.call && challenge.blockId && challenge.status !== "done") {
    redirect({
      href: `/checkpoint/${challenge.blockId}${sessionId ? `?${STUDY_SESSION_PARAM}=${sessionId}` : ""}`,
      locale: lang,
    });
  }

  return (
    <MainLearnProvider>
      <ChallengeClient
        challenge={challenge}
        movedBy={readParam(query, MOVED_PARAM)}
        sessionId={sessionId}
      />
    </MainLearnProvider>
  );
}

/**
 * A phase's checkpoint or the week's challenge (an exam's mock), by its plan item: its intro
 * before its day and on it, where it starts.
 */
export default function ChallengePage(props: Props) {
  return (
    <Suspense fallback={<ChallengeSkeleton />}>
      <ChallengeContent {...props} />
    </Suspense>
  );
}
