import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getWeeklyRecap } from "@zoonk/core/milestones/weekly-recap";
import { getSession } from "@zoonk/core/users/session";
import { LogbookScreen } from "@zoonk/learn/logbook";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Logbook") };
}

function LogbookSkeleton() {
  return (
    <TaskSkeleton title={<Skeleton className="h-1 w-24 rounded-xs" />}>
      <Skeleton className="h-12 w-full max-w-80" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <Skeleton className="rounded-option h-20" />
        <Skeleton className="rounded-option h-20" />
      </div>
    </TaskSkeleton>
  );
}

async function LogbookContent() {
  // The root param, not `params`: a prefetch warms its caches with `params` still pending.
  const [goal, session] = await Promise.all([getCurrentGoal(), getSession()]);

  const result = await getWeeklyRecap({ goalId: goal?.id });

  if (result.status === "unauthorized") {
    return <AuthGateScreen next="/logbook" />;
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
      <LogbookScreen
        hrefs={{ close: "/buddy", start: "/today" }}
        // A guest has no name of their own: their placeholder would read "What a week, Guest!".
        learnerName={(!session?.user.isAnonymous && session?.user.name.split(" ")[0]) || null}
        recap={result.recap}
      />
    </MainLearnProvider>
  );
}

export default function LogbookPage() {
  return (
    <Suspense fallback={<LogbookSkeleton />}>
      <LogbookContent />
    </Suspense>
  );
}
