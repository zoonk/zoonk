import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { redirect } from "@/i18n/navigation";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { mistakePracticeInputSchema } from "@zoonk/core/mistakes/contract";
import { getMistakePractice } from "@zoonk/core/mistakes/practice";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { MistakePracticeClient } from "./practice-client";

/** One learner's own mistakes: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Practice mistakes") };
}

type Props = PageProps<"/[lang]/mistakes/practice">;

/**
 * The run's full screen, around the run and its placeholder only: the sign-in screen and the
 * not-found answer bring their own `main`.
 */
function PracticeMain({ children }: { children: React.ReactNode }) {
  return <main className="bg-background flex min-h-dvh flex-col">{children}</main>;
}

/** "Practice this skill" opens practice with `?skill=` and the skill's id; anything else is ignored. */
function readSkillId(query: Awaited<Props["searchParams"]>): string | undefined {
  const skill = Array.isArray(query.skill) ? query.skill[0] : query.skill;
  const parsed = mistakePracticeInputSchema.shape.skillId.safeParse(skill);
  return parsed.success ? parsed.data : undefined;
}

async function PracticeBody({ searchParams }: Pick<Props, "searchParams">) {
  const [language, session, goal, query, tutor] = await Promise.all([
    lang(),
    getSession(),
    getCurrentGoal(),
    searchParams,
    getTutorViewer(),
  ]);

  const skillId = readSkillId(query);

  // A signed-out learner (or one whose session ended) signs in again, like on every learner page.
  if (!session) {
    return (
      <AuthGateScreen
        next={skillId ? `/mistakes/practice?skill=${skillId}` : "/mistakes/practice"}
      />
    );
  }

  if (!goal) {
    redirect({ href: "/start", locale: language });
    return null;
  }

  const result = await getMistakePractice({ goalId: goal.id, skillId });

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <TaskNotFound />
      </NotFoundPage>
    );
  }

  return (
    <PracticeMain>
      <MistakePracticeClient
        goalId={goal.id}
        practice={result.practice}
        trueFalseLabels={result.trueFalseLabels}
        tutor={tutor}
      />
    </PracticeMain>
  );
}

/**
 * The task header's place with its segments' row, the question in its column, then the pinned
 * action bar, as the run lays them out.
 */
function PracticeSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="size-9 rounded-lg" />
      </div>

      <div className="max-w-column mx-auto w-full px-4 pb-1">
        <Skeleton className="h-1 w-full rounded-xs" />
      </div>

      <div className="max-w-column mx-auto flex w-full flex-1 flex-col gap-2.5 px-4 pt-4 pb-8">
        <Skeleton className="mb-3.5 h-5 w-full" />
        <Skeleton className="mb-3.5 h-7 w-2/3" />
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
      </div>

      <div className="border-border border-t">
        <div className="max-w-column mx-auto w-full px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </>
  );
}

/**
 * "Practice mistakes": a short run over a few open mistakes, each drilled by why it happened,
 * full screen like a lesson; "Practice this skill" runs it over one skill's mistakes.
 */
export default function MistakePracticePage({ searchParams }: Props) {
  return (
    <MainLearnProvider>
      <Suspense
        fallback={
          <PracticeMain>
            <PracticeSkeleton />
          </PracticeMain>
        }
      >
        <PracticeBody searchParams={searchParams} />
      </Suspense>
    </MainLearnProvider>
  );
}
