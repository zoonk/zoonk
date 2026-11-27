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
import { DrawnMath } from "@zoonk/learn/rich-text/drawn-math";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { MistakePracticeClient } from "./practice-client";
import { PracticeSkeleton } from "./practice-skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Practice mistakes") };
}

type Props = PageProps<"/[lang]/mistakes/practice">;

function PracticeMain({ children }: { children: React.ReactNode }) {
  return <main className="bg-background flex min-h-dvh flex-col">{children}</main>;
}

function readParam(query: Awaited<Props["searchParams"]>, name: string): string | undefined {
  const value = query[name];
  return Array.isArray(value) ? value[0] : value;
}

/** One scope at a time: a day's block, a finished mock, a skill, or the whole notebook. */
function readScope(query: Awaited<Props["searchParams"]>) {
  const parsed = mistakePracticeInputSchema.safeParse({
    blockId: readParam(query, "blockId"),
    mockId: readParam(query, "mockId"),
    skillId: readParam(query, "skill"),
  });

  return parsed.success
    ? { blockId: parsed.data.blockId, mockId: parsed.data.mockId, skillId: parsed.data.skillId }
    : {};
}

function getPracticeHref({ blockId, mockId, skillId }: ReturnType<typeof readScope>): string {
  const params = new URLSearchParams({
    ...(blockId && { blockId }),
    ...(mockId && { mockId }),
    ...(skillId && { skill: skillId }),
  });

  return params.size > 0 ? `/mistakes/practice?${params}` : "/mistakes/practice";
}

async function PracticeBody({ searchParams }: Pick<Props, "searchParams">) {
  const [language, session, goal, query, tutor] = await Promise.all([
    lang(),
    getSession(),
    getCurrentGoal(),
    searchParams,
    getTutorViewer(),
  ]);

  const scope = readScope(query);

  if (!session) {
    return <AuthGateScreen next={getPracticeHref(scope)} />;
  }

  if (!goal) {
    redirect({ href: "/start", locale: language });
    return null;
  }

  const result = await getMistakePractice({ ...scope, goalId: goal.id, includeAllFormats: true });

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <TaskNotFound />
      </NotFoundPage>
    );
  }

  return (
    <PracticeMain>
      <DrawnMath content={result.practice}>
        <MistakePracticeClient
          blockId={scope.blockId}
          goalId={goal.id}
          practice={result.practice}
          trueFalseLabels={result.trueFalseLabels}
          tutor={tutor}
        />
      </DrawnMath>
    </PracticeMain>
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
