import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { getSessionBlockReturn } from "@/lib/session/session-block-return";
import { getMock } from "@zoonk/core/exams/mocks/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MockClient } from "./mock-client";

type Props = PageProps<"/[lang]/mock/[blockId]">;

/** A mock is one learner's own exam: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Mock exam") };
}

function MockSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-32 w-full rounded-3xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-full" />
    </main>
  );
}

async function MockContent({ params, searchParams }: Props) {
  // A mock is the learner's own and its clock runs: render per request.
  await connection();
  const [{ blockId, lang }, query] = await Promise.all([params, searchParams]);

  const [result, tutor] = await Promise.all([getMock(blockId), getTutorViewer()]);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  const { mock } = result;

  const sessionReturn = mock.sessionId
    ? getSessionBlockReturn({ query, sessionId: mock.sessionId })
    : { continueHref: "/today", search: "" };

  // Before it starts, it's introduced (and started) by its challenge page, by its plan item.
  if (mock.status === "ready") {
    if (!mock.planItemId) {
      notFound();
    }

    redirect({ href: `/challenge/${mock.planItemId}${sessionReturn.search}`, locale: lang });
  }

  // A placement mock goes back to onboarding, where its answers set the plan's start.
  const continueHref =
    mock.purpose === "placement" && mock.goalId
      ? `/start/${mock.goalId}`
      : sessionReturn.continueHref;

  return (
    <MainLearnProvider>
      <MockClient continueHref={continueHref} mock={mock} tutor={tutor} />
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
