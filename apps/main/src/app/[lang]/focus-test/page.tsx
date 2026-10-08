import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getFocusTest } from "@zoonk/core/plans/focus-test/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { FocusTestClient } from "./focus-test-client";
import {
  FOCUS_TEST_GOAL_PARAM,
  FOCUS_TEST_RUN_PARAM,
  FOCUS_TEST_STARTED_PARAM,
} from "./focus-test-params";

type Props = PageProps<"/[lang]/focus-test">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Focus test") };
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

async function FocusTestBody({ searchParams }: Props) {
  const [locale, query, current] = await Promise.all([lang(), searchParams, getCurrentGoal()]);
  const goalParam = readParam(query[FOCUS_TEST_GOAL_PARAM]);
  const goalId = goalParam && isUuid(goalParam) ? goalParam : (current?.id ?? null);

  if (!goalId) {
    redirect({ href: "/today", locale });
    return null;
  }

  const result = await getFocusTest({ goalId });

  // No focus to choose (a plan of one area) or not the learner's goal: the Journey holds the plan.
  if (result.status !== "ready") {
    redirect({ href: "/journey", locale });
    return null;
  }

  return (
    <FocusTestClient
      generationId={readParam(query[FOCUS_TEST_RUN_PARAM])}
      page={{
        closeHref: goalParam ? `/start/${goalId}` : "/journey",
        doneHref: "/journey",
        goalId,
        goalParam: goalParam && isUuid(goalParam) ? goalParam : null,
      }}
      started={readParam(query[FOCUS_TEST_STARTED_PARAM]) !== null}
      test={result.focusTest}
    />
  );
}

function FocusTestSkeleton() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-3 py-2 sm:px-4">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <span className="size-9" />
      </header>
      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-6">
        <Skeleton className="h-80 w-full rounded-3xl" />
        <Skeleton className="h-14 w-full rounded-full" />
      </section>
    </main>
  );
}

/**
 * The focus test, full screen like every task: a few questions on each subject worth most, whose
 * answers choose where the plan's depth goes. Offered beside "Choose where to focus" when the
 * learner's time doesn't cover everything in depth.
 */
export default function FocusTestPage(props: Props) {
  return (
    <Suspense fallback={<FocusTestSkeleton />}>
      <MainLearnProvider>
        <main>
          <FocusTestBody {...props} />
        </main>
      </MainLearnProvider>
    </Suspense>
  );
}
