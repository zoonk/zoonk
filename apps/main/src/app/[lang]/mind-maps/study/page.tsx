import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { redirect } from "@/i18n/navigation";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { listChapterLessonMaps } from "@zoonk/core/mind-maps/lesson-maps";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { getSession } from "@zoonk/core/users/session";
import { type MindMapPlace, buildStudyHref, readMindMapTab } from "@zoonk/learn/mind-maps/urls";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { buildMindMapDeck, findDeckStart } from "@zoonk/player/mind-maps/deck";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { MindMapStudyClient } from "./study-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Mind maps") };
}

type Props = PageProps<"/[lang]/mind-maps/study">;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readPlace(query: Awaited<Props["searchParams"]>): MindMapPlace | null {
  const chapterId = first(query.at);
  const lessonId = first(query.lesson);

  if (!chapterId || !isUuid(chapterId)) {
    return null;
  }

  return { chapterId, lessonId: lessonId && isUuid(lessonId) ? lessonId : null };
}

async function readLessons({ chapterId, goalId }: { chapterId: string; goalId: string }) {
  const result = await listChapterLessonMaps({ chapterId, goalId });
  return result.status === "ready" ? result.lessonMaps.lessons : null;
}

async function StudyBody({ searchParams }: Pick<Props, "searchParams">) {
  const [language, session, goal, query] = await Promise.all([
    lang(),
    getSession(),
    getCurrentGoal(),
    searchParams,
  ]);

  const view = readMindMapTab(first(query.view)) ?? "chapters";
  const place = readPlace(query);

  if (!session) {
    return <AuthGateScreen next={buildStudyHref({ place, study: "/mind-maps/study", view })} />;
  }

  if (!goal) {
    redirect({ href: "/start", locale: language });
    return null;
  }

  const result = await listGoalMindMaps({ goalId: goal.id });

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <TaskNotFound />
      </NotFoundPage>
    );
  }

  const deck = buildMindMapDeck({ mindMaps: result.mindMaps, view });
  const start = findDeckStart({ deck, place });
  const opening = deck[start];

  // The lesson maps of the chapter the deck opens on, so its first map is drawn with the page.
  const lessons =
    opening?.kind === "lesson"
      ? await readLessons({ chapterId: opening.chapterId, goalId: goal.id })
      : null;

  return (
    <MindMapStudyClient
      deck={deck}
      goalId={goal.id}
      lessons={opening && lessons ? { [opening.chapterId]: lessons } : {}}
      start={start}
      view={view}
    />
  );
}

function StudySkeleton() {
  return (
    <TaskSkeleton
      actions={<Skeleton className="size-11 shrink-0 rounded-lg" />}
      menu
      title={<Skeleton className="h-4 w-40" />}
    >
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </TaskSkeleton>
  );
}

export default function MindMapStudyPage({ searchParams }: Props) {
  return (
    <MainLearnProvider>
      <Suspense fallback={<StudySkeleton />}>
        <StudyBody searchParams={searchParams} />
      </Suspense>
    </MainLearnProvider>
  );
}
