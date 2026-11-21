import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { getEssay } from "@zoonk/core/exams/essays/get";
import { getSessionPageView } from "@zoonk/core/sessions/page";
import { DrawnMath } from "@zoonk/learn/rich-text/drawn-math";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { EssayClient } from "./essay-client";
import { WritingStartClient } from "./writing-start-client";

type Props = PageProps<"/[lang]/essay/[blockId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Writing practice") };
}

function EssaySkeleton() {
  return (
    <TaskSkeleton
      aside={<Skeleton className="h-40 w-full" />}
      title={<Skeleton className="h-4 w-40" />}
    >
      <div className="flex flex-col gap-3 lg:hidden">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-5/6" />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="min-h-72 w-full flex-1 rounded-lg lg:min-h-36" />
      </div>
    </TaskSkeleton>
  );
}

/**
 * A writing block before its question is admitted, read from the learner's own day: the page shows
 * what the server says, never what an address claims. An owned block the day no longer lists was
 * dropped by a re-read of the exam's notice.
 */
async function getUnadmittedWriting(blockId: string) {
  const day = await getSessionPageView({ blockId });

  if (day.status !== "ready") {
    return null;
  }

  const sessionId = day.session.id;
  const block = day.session.blocks.find(({ id }) => id === blockId);

  if (!block) {
    return { initial: { status: "taskRemoved" } as const, sessionId, task: null };
  }

  if (!block.writingUnit) {
    return null;
  }

  const task = {
    minutes: block.estimatedMinutes,
    title: block.title,
    unit: block.writingUnit,
    writingTask: block.writingTask ?? null,
  };

  const initial =
    block.writingAvailability?.status === "tomorrow"
      ? ({ status: "limitReached", task } as const)
      : ({ status: "unasked" } as const);

  return { initial, sessionId, task };
}

async function EssayContent({ params }: Pick<Props, "params">) {
  const { blockId } = await params;
  const result = await getEssay({ blockId });

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={`/essay/${blockId}`} />;
  }

  const unadmitted = result.status === "notFound" ? await getUnadmittedWriting(blockId) : null;

  if (unadmitted) {
    return (
      <MainLearnProvider>
        <WritingStartClient blockId={blockId} {...unadmitted} />
      </MainLearnProvider>
    );
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
      <DrawnMath content={result.essay}>
        <EssayClient essay={result.essay} />
      </DrawnMath>
    </MainLearnProvider>
  );
}

export default function EssayPage({ params }: Props) {
  return (
    <Suspense fallback={<EssaySkeleton />}>
      <EssayContent params={params} />
    </Suspense>
  );
}
