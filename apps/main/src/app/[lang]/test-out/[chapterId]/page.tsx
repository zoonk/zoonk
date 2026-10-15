import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { redirect } from "@/i18n/navigation";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { TEST_OUT_FROM_SESSION_PARAM, TEST_OUT_RUN_PARAM } from "@/lib/test-out/test-out-params";
import { getChapterTestOut } from "@zoonk/core/learner/test-out/get";
import { getGoalPlanScreen } from "@zoonk/core/plans/get";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { findPlanChapter } from "./_utils/plan-chapter";
import { TestOutClient, TestOutPreparingClient } from "./test-out-client";

type Props = PageProps<"/[lang]/test-out/[chapterId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  // Not the bare "Test out": that message is also the plan's compact action in @zoonk/learn, and
  // this catalog's wording would replace it there.
  return { robots: { follow: false, index: false }, title: t("Test out of a chapter") };
}

/** The chapter as the plan shows it (its title and lessons left), since the test-out has none. */
async function loadPlanChapter({ chapterId, goalId }: { chapterId: string; goalId: string }) {
  const result = await getGoalPlanScreen(goalId);

  if (result.status !== "ready") {
    return null;
  }

  return findPlanChapter({ chapterId, phases: result.plan.phases });
}

async function TestOutBody({ params, searchParams }: Props) {
  const t = await getExtracted();

  const [{ chapterId, lang }, query, goal] = await Promise.all([
    params,
    searchParams,
    getCurrentGoal(),
  ]);

  if (!goal) {
    redirect({ href: "/today", locale: lang });
    return null;
  }

  const [result, chapter] = await Promise.all([
    getChapterTestOut({ chapterId, goalId: goal.id }),
    loadPlanChapter({ chapterId, goalId: goal.id }),
  ]);

  if (result.status !== "ready" && result.status !== "plusRequired") {
    return (
      <NotFoundPage>
        <TaskNotFound />
      </NotFoundPage>
    );
  }

  const page = {
    chapterId,
    chapterTitle: chapter?.title ?? t("This chapter"),
    closeHref: query[TEST_OUT_FROM_SESSION_PARAM] ? "/today" : `/content/chapters/${chapterId}`,
    goalId: goal.id,
  };

  // Past a free exam plan's first week the test comes with Plus: it says so instead of starting.
  if (result.status === "plusRequired") {
    return <TestOutPreparingClient generationId={null} page={page} plusRequired />;
  }

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
      lessonsLeft={chapter?.lessonsLeft ?? null}
      page={page}
      passMark={result.testOut.passMark}
      questions={result.testOut.questions}
      trueFalseLabels={result.testOut.trueFalseLabels}
    />
  );
}

/**
 * The test's own shape (its chrome, a question and its options, and the aside from `lg`), so
 * nothing moves when it arrives.
 */
function TestOutSkeleton() {
  return (
    <TaskSkeleton
      actions={<Skeleton className="h-11 w-36 shrink-0 rounded-lg" />}
      aside={
        <>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </>
      }
      menu
      progress
      title={<Skeleton className="h-4 w-40" />}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-2/3 lg:hidden" />
        <Skeleton className="ml-auto h-3 w-10" />
      </div>
      <Skeleton className="h-7 w-5/6" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
      </div>
    </TaskSkeleton>
  );
}

/** A quick test that skips a chapter the learner already knows, full screen like every task. */
export default function TestOutPage(props: Props) {
  return (
    <Suspense fallback={<TestOutSkeleton />}>
      <MainLearnProvider>
        <TestOutBody {...props} />
      </MainLearnProvider>
    </Suspense>
  );
}
