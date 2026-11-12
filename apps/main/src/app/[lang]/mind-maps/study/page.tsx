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
import { buildMindMapDeck, findDeckStart } from "@zoonk/player/mind-maps/deck";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { MindMapStudyClient } from "./study-client";
import { StudySkeleton } from "./study-skeleton";

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
      saved={result.mindMaps.saved.map(({ kind, targetId }) => ({ kind, targetId }))}
      start={start}
      view={view}
    />
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
