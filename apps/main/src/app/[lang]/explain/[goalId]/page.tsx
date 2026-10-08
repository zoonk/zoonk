import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { getExplanation } from "@zoonk/core/view-models/explain/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExplainClient } from "./explain-client";

type Props = PageProps<"/[lang]/explain/[goalId]">;

/** A learner's own question: nothing here is for search. */
export const metadata: Metadata = { robots: { follow: false, index: false } };

async function ExplainContent({ params }: Props) {
  const { goalId, lang } = await params;

  if (!isUuid(goalId)) {
    notFound();
  }

  const [result, session, profile] = await Promise.all([
    getExplanation({ goalId }),
    getSession(),
    getLearningProfile(),
  ]);

  if (result.status === "unauthorized") {
    redirect({ href: "/start", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <MainLearnProvider>
      <ExplainClient
        explanation={result.explanation}
        hasSession={Boolean(session)}
        soundsEnabled={profile?.soundsEnabled ?? true}
      />
    </MainLearnProvider>
  );
}

function ExplainSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 pt-20">
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-5 w-2/3" />
    </main>
  );
}

/** A quick explanation for one of the learner's questions: about five screens and one check. */
export default function ExplainPage(props: Props) {
  return (
    <Suspense fallback={<ExplainSkeleton />}>
      <ExplainContent {...props} />
    </Suspense>
  );
}
