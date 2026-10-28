import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { getEssay } from "@zoonk/core/exams/essays/get";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { EssayClient } from "./essay-client";

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

async function EssayContent({ params }: Props) {
  const { blockId } = await params;

  const result = await getEssay({ blockId });

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={`/essay/${blockId}`} />;
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
      <EssayClient essay={result.essay} />
    </MainLearnProvider>
  );
}

export default function EssayPage(props: Props) {
  return (
    <Suspense fallback={<EssaySkeleton />}>
      <EssayContent {...props} />
    </Suspense>
  );
}
