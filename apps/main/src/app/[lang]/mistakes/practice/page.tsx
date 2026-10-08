import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getMistakePractice } from "@zoonk/core/mistakes/practice";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { MistakePracticeClient } from "./practice-client";

/** One learner's own mistakes: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Practice mistakes") };
}

async function PracticeBody() {
  const [language, session, goal] = await Promise.all([lang(), getSession(), getCurrentGoal()]);

  // A signed-out learner (or one whose session ended) signs in again, like on every learner page.
  if (!session) {
    redirect({ href: "/login", locale: language });
  }

  if (!goal) {
    redirect({ href: "/start", locale: language });
    return null;
  }

  const result = await getMistakePractice({ goalId: goal.id });

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <MistakePracticeClient
      goalId={goal.id}
      practice={result.practice}
      trueFalseLabels={result.trueFalseLabels}
    />
  );
}

/** The task header's place, then the question in its column. */
function PracticeSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      <Skeleton className="h-1 w-full rounded-none" />

      <div className="mx-auto flex w-full max-w-150 flex-1 flex-col gap-5 px-4 pt-4 pb-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </>
  );
}

/**
 * "Practice mistakes": a short run over a few open mistakes, each drilled by why it happened,
 * full screen like a lesson.
 */
export default function MistakePracticePage() {
  return (
    <MainLearnProvider>
      <main className="bg-background flex min-h-dvh flex-col">
        <Suspense fallback={<PracticeSkeleton />}>
          <PracticeBody />
        </Suspense>
      </main>
    </MainLearnProvider>
  );
}
