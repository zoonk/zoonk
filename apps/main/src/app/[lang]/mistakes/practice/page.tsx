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
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { MistakePracticeClient } from "./practice-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Practice mistakes") };
}

type Props = PageProps<"/[lang]/mistakes/practice">;

function PracticeMain({ children }: { children: React.ReactNode }) {
  return <main className="bg-background flex min-h-dvh flex-col">{children}</main>;
}

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

function PracticeSkeleton() {
  return (
    <TaskSkeleton aside menu progress title={<Skeleton className="h-4 w-32" />}>
      <Skeleton className="mb-3.5 h-5 w-full" />
      <Skeleton className="mb-3.5 h-7 w-2/3" />
      <Skeleton className="rounded-option h-12 w-full" />
      <Skeleton className="rounded-option h-12 w-full" />
    </TaskSkeleton>
  );
}

export default function MistakePracticePage({ searchParams }: Props) {
  return (
    <MainLearnProvider>
      <Suspense fallback={<PracticeSkeleton />}>
        <PracticeBody searchParams={searchParams} />
      </Suspense>
    </MainLearnProvider>
  );
}
