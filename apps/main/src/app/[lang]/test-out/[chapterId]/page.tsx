import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { TEST_OUT_FROM_SESSION_PARAM, TEST_OUT_RUN_PARAM } from "@/lib/test-out/test-out-params";
import { getChapterTestOut } from "@zoonk/core/learner/test-out/get";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TestOutClient, TestOutPreparingClient } from "./test-out-client";

type Props = PageProps<"/[lang]/test-out/[chapterId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  // Not the bare "Test out": that message is also the plan's compact action in @zoonk/learn, and
  // this catalog's wording would replace it there.
  return { robots: { follow: false, index: false }, title: t("Test out of a chapter") };
}

/** The chapter's title as the plan shows it, since the test-out itself carries only questions. */
async function findChapterTitle({ chapterId, goalId }: { chapterId: string; goalId: string }) {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    return null;
  }

  const chapters = result.plan.phases.flatMap((phase) => phase.chapters ?? []);
  return chapters.find((chapter) => chapter.chapterId === chapterId)?.title ?? null;
}

async function TestOutBody({ params, searchParams }: Props) {
  const [{ chapterId, lang }, query, goal, t] = await Promise.all([
    params,
    searchParams,
    getCurrentGoal(),
    getExtracted(),
  ]);

  if (!goal) {
    redirect({ href: "/today", locale: lang });
    return null;
  }

  const [result, title] = await Promise.all([
    getChapterTestOut({ chapterId, goalId: goal.id }),
    findChapterTitle({ chapterId, goalId: goal.id }),
  ]);

  if (result.status !== "ready") {
    notFound();
  }

  const page = {
    chapterId,
    chapterTitle: title ?? t("This chapter"),
    closeHref: query[TEST_OUT_FROM_SESSION_PARAM] ? "/today" : `/content/chapters/${chapterId}`,
    goalId: goal.id,
  };

  // Its questions are written on the learner's tap (on the chapter's page, or here), never on
  // this page's load: a run started by the tap is followed here until the test opens.
  if (result.testOut.questions.length === 0) {
    const run = query[TEST_OUT_RUN_PARAM];

    return (
      <TestOutPreparingClient generationId={typeof run === "string" ? run : null} page={page} />
    );
  }

  return (
    <TestOutClient
      page={page}
      passMark={result.testOut.passMark}
      questions={result.testOut.questions}
      trueFalseLabels={result.testOut.trueFalseLabels}
    />
  );
}

function TestOutSkeleton() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-3 py-2 sm:px-4">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-40" />
        <span className="size-9" />
      </header>
      <Skeleton className="h-1 w-full rounded-none" />
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </section>
    </main>
  );
}

/** A quick test that skips a chapter the learner already knows, full screen like every task. */
export default function TestOutPage(props: Props) {
  return (
    <Suspense fallback={<TestOutSkeleton />}>
      <MainLearnProvider>
        <main>
          <TestOutBody {...props} />
        </main>
      </MainLearnProvider>
    </Suspense>
  );
}
