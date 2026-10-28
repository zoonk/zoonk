import { AuthGateScreen } from "@/components/auth-gate";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";
import { withQuery } from "@/lib/with-query";
import { getChallenge } from "@zoonk/core/checkpoints/challenge";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChallengeClient } from "./challenge-client";
import { MOVED_PARAM } from "./challenge-params";

type Props = PageProps<"/[lang]/challenge/[planItemId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Challenge") };
}

function ChallengeSkeleton() {
  return (
    <TaskSkeleton aside={<Skeleton className="h-24 w-full" />}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-5/6" />
      </div>
      <Skeleton className="h-3 w-1/2" />
    </TaskSkeleton>
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
  const movedBy = readParam(query, MOVED_PARAM);
  const result = await getChallenge({ input: {}, movedBy, planItemId });

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={withQuery(`/challenge/${planItemId}`, query)} />;
  }

  if (result.status !== "ready") {
    return redirect({ href: "/today", locale: lang });
  }

  const { challenge } = result;
  const sessionId = readParam(query, STUDY_SESSION_PARAM);

  if (challenge.call && challenge.blockId && challenge.status !== "done" && !challenge.locked) {
    redirect({
      href: `/checkpoint/${challenge.blockId}${sessionId ? `?${STUDY_SESSION_PARAM}=${sessionId}` : ""}`,
      locale: lang,
    });
  }

  return (
    <MainLearnProvider>
      <ChallengeClient
        challenge={challenge}
        moved={movedBy ? { changeId: movedBy, effect: result.moved ?? null } : null}
        sessionId={sessionId}
      />
    </MainLearnProvider>
  );
}

export default function ChallengePage(props: Props) {
  return (
    <Suspense fallback={<ChallengeSkeleton />}>
      <ChallengeContent {...props} />
    </Suspense>
  );
}
