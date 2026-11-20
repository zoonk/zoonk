import { NotFoundPage } from "@/components/errors/not-found-page";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { listCurrentUserCompletedLessons } from "@zoonk/core/completed-lessons/list-current-user";
import { LearnPageBar } from "@zoonk/learn/bar";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { LearnNotFound } from "../_components/learn-not-found";
import { CompletedLessonsClient } from "./completed-lessons-client";

/** The page holds the whole list, so narrowing it and showing more of it load nothing. */
const MAX_LISTED = 1000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Completed lessons") };
}

/** `listed` only where the sidebar lists the page: the placeholder, which can't know, and never without a goal. */
async function CompletedLessonsBar({ listed = false }: { listed?: boolean }) {
  const t = await getExtracted();

  return (
    <LearnPageBar
      back={{ href: "/today" }}
      listed={listed ? "learner" : undefined}
      root
      title={t("Completed lessons")}
    />
  );
}

async function CompletedLessonsBody() {
  const goal = await getCurrentGoal();

  if (!goal) {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={<CompletedLessonsBar />}
        description={t("The lessons you've finished, ready to do again anytime.")}
        next="/completed-lessons"
        title={t("Completed lessons")}
      />
    );
  }

  const result = await listCurrentUserCompletedLessons({
    goalId: goal.id,
    limit: MAX_LISTED,
    offset: 0,
  });

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  return <CompletedLessonsClient filter={result.filter} lessons={result.lessons} />;
}

async function CompletedLessonsSkeleton() {
  const t = await getExtracted();

  return (
    <DetailSkeleton
      aside={false}
      bar={<CompletedLessonsBar listed />}
      title={t("Completed lessons")}
    />
  );
}

export default function CompletedLessonsPage() {
  return (
    <Suspense fallback={<CompletedLessonsSkeleton />}>
      <CompletedLessonsBody />
    </Suspense>
  );
}
