import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { redirect } from "@/i18n/navigation";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { getSessionBlockReturn } from "@/lib/session/session-block-return";
import { withQuery } from "@/lib/with-query";
import { getMock } from "@zoonk/core/exams/mocks/get";
import { TaskSkeleton } from "@zoonk/learn/task-layout";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { MockClient } from "./mock-client";

type Props = PageProps<"/[lang]/mock/[blockId]">;

/** A mock is one learner's own exam: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Mock exam") };
}

/**
 * A running section's own shape (its chrome with the clock, a question and its options, Flag and
 * Next in the bar, and the answer sheet beside them from `lg`), so nothing moves when it arrives.
 */
function MockSkeleton() {
  return (
    <TaskSkeleton
      actions={<Skeleton className="h-11 w-28 shrink-0 rounded-lg" />}
      aside={
        <>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-36 w-full" />
        </>
      }
      menu
      progress
      title={<Skeleton className="h-6 w-24" />}
    >
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-7 w-5/6" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
        <Skeleton className="rounded-option h-12 w-full" />
      </div>
    </TaskSkeleton>
  );
}

async function MockContent({ params, searchParams }: Props) {
  // A mock is the learner's own and its clock runs: render per request.
  await connection();
  const [{ blockId, lang }, query] = await Promise.all([params, searchParams]);

  const [result, tutor] = await Promise.all([getMock(blockId), getTutorViewer()]);

  if (result.status === "unauthorized") {
    return (
      <>
        <LearnerWitness />
        <AuthGateScreen next={withQuery(`/mock/${blockId}`, query)} />
      </>
    );
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnerWitness />
        <TaskNotFound />
      </NotFoundPage>
    );
  }

  const { mock } = result;

  const sessionReturn = mock.sessionId
    ? getSessionBlockReturn({ query, sessionId: mock.sessionId })
    : { continueHref: "/today", search: "" };

  // Before it starts, it's introduced (and started) by its challenge page, by its plan item.
  if (mock.status === "ready") {
    if (!mock.planItemId) {
      return (
        <NotFoundPage>
          <LearnerWitness />
          <TaskNotFound />
        </NotFoundPage>
      );
    }

    redirect({ href: `/challenge/${mock.planItemId}${sessionReturn.search}`, locale: lang });
  }

  // A placement mock goes back to onboarding, where its answers set the plan's start.
  const continueHref =
    mock.purpose === "placement" && mock.goalId
      ? `/start/${mock.goalId}`
      : sessionReturn.continueHref;

  // A new mock after one whose time ran out: the plan's starts from its challenge, as it first did.
  const againHref = mock.planItemId
    ? `/challenge/${mock.planItemId}${sessionReturn.search}`
    : MOCK_ENTRY_HREFS.choose;

  // The buddy reads and changes the plan of the goal the mock was taken for, as core does.
  return (
    <MainLearnProvider>
      <LearnerWitness />
      <MockClient
        againHref={againHref}
        continueHref={continueHref}
        mock={mock}
        tutor={{ ...tutor, goalId: mock.goalId ?? tutor.goalId }}
      />
    </MainLearnProvider>
  );
}

/** The started weekly mock exam in real conditions, full screen like the exam room. */
export default function MockPage(props: Props) {
  return (
    <Suspense fallback={<MockSkeleton />}>
      <MockContent {...props} />
    </Suspense>
  );
}
