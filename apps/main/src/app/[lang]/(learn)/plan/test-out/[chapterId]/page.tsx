import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getChapterTestOut } from "@zoonk/core/learner/test-out/get";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { TestOutRun } from "@zoonk/learn/test-out";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../../../_components/learn-no-goal";
import { submitTestOutAction } from "./test-out-actions";
import { TestOutPreparingClient } from "./test-out-preparing-client";

type Props = PageProps<"/[lang]/plan/test-out/[chapterId]">;

const BACK_HREF = "/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  // Not the bare "Test out": that message is also the plan's compact action in @zoonk/learn, and
  // this catalog's wording would replace it there.
  return { title: t("Test out of a chapter") };
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

async function TestOutBody({ params }: Pick<Props, "params">) {
  const [{ chapterId }, goal, t] = await Promise.all([params, getCurrentGoal(), getExtracted()]);

  if (!goal) {
    return <LearnNoGoal />;
  }

  const [result, title] = await Promise.all([
    getChapterTestOut({ chapterId, goalId: goal.id }),
    findChapterTitle({ chapterId, goalId: goal.id }),
  ]);

  if (result.status !== "ready") {
    notFound();
  }

  const chapterTitle = title ?? t("This chapter");

  // Its questions are written when the learner asks for them, never on this page's load.
  if (result.testOut.questions.length === 0) {
    return (
      <TestOutPreparingClient
        backHref={BACK_HREF}
        chapterId={chapterId}
        chapterTitle={chapterTitle}
        goalId={goal.id}
      />
    );
  }

  return (
    <TestOutRun
      backHref={BACK_HREF}
      chapterTitle={chapterTitle}
      onSubmit={submitTestOutAction.bind(null, { chapterId, goalId: goal.id })}
      passMark={result.testOut.passMark}
      questions={result.testOut.questions}
      trueFalseLabels={result.testOut.trueFalseLabels}
    />
  );
}

/** A quick test that skips a chapter the learner already knows. */
export default function TestOutPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <TestOutBody params={params} />
    </Suspense>
  );
}
