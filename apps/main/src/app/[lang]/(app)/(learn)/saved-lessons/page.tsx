import { NotFoundPage } from "@/components/errors/not-found-page";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { listCurrentUserSavedLessons } from "@zoonk/core/saved-lessons/list";
import { LearnPageBar } from "@zoonk/learn/bar";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { LearnNotFound } from "../_components/learn-not-found";
import { SavedLessonsClient } from "./saved-lessons-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Saved lessons") };
}

async function SavedLessonsBar() {
  const t = await getExtracted();

  return (
    <LearnPageBar back={{ href: "/today" }} listed="learner" root title={t("Saved lessons")} />
  );
}

async function SavedLessonsBody() {
  const goal = await getCurrentGoal();

  if (!goal) {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={<SavedLessonsBar />}
        description={t("The lessons you save, ready to do again anytime.")}
        next="/saved-lessons"
        title={t("Saved lessons")}
      />
    );
  }

  const result = await listCurrentUserSavedLessons({ goalId: goal.id });

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  // A switch of goal on this page starts the list over: rows kept for one goal never show in another.
  return <SavedLessonsClient goalId={goal.id} key={goal.id} lessons={result.lessons} />;
}

async function SavedLessonsSkeleton() {
  const t = await getExtracted();

  return <DetailSkeleton aside={false} bar={<SavedLessonsBar />} title={t("Saved lessons")} />;
}

export default function SavedLessonsPage() {
  return (
    <Suspense fallback={<SavedLessonsSkeleton />}>
      <SavedLessonsBody />
    </Suspense>
  );
}
