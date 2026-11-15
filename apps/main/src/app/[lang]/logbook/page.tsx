import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getWeeklyRecap } from "@zoonk/core/milestones/weekly-recap";
import { getSession } from "@zoonk/core/users/session";
import { LogbookScreen, LogbookSkeleton } from "@zoonk/learn/logbook";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Weekly summary") };
}

function LogbookPageSkeleton() {
  return (
    <TaskSkeleton>
      <LogbookSkeleton />
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
    <Suspense fallback={<LogbookPageSkeleton />}>
      <LogbookContent />
    </Suspense>
  );
}
