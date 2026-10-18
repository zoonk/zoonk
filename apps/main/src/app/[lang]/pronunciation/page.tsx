import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { withQuery } from "@/lib/with-query";
import { getPronunciationReviews } from "@zoonk/core/language/pronunciation/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { PronunciationClient } from "./pronunciation-client";

type Props = PageProps<"/[lang]/pronunciation">;

/** A learner's own mispronounced words: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Say it again") };
}

function PronunciationSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
      <Skeleton className="size-9 rounded-lg" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-8 w-1/2 rounded-lg" />
        <Skeleton className="h-4 w-40 rounded-md" />
      </div>
      <Skeleton className="h-7.5 w-48 rounded-md" />
      <Skeleton className="mt-auto h-11 w-full rounded-lg" />
    </main>
  );
}

async function PronunciationContent({ searchParams }: Pick<Props, "searchParams">) {
  const query = await searchParams;
  const { goal } = query;
  const goalId = typeof goal === "string" && isUuid(goal) ? goal : undefined;

  const result = await getPronunciationReviews({ goalId });

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={withQuery("/pronunciation", query)} />;
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <TaskNotFound />
      </NotFoundPage>
    );
  }

  return (
    <MainLearnProvider>
      <PronunciationClient reviews={result.reviews} />
    </MainLearnProvider>
  );
}

/**
 * "Say it again": the words a language learner mispronounced, back when they're due, one at a
 * time with their native sound, a slow version, the respelling and the tip.
 */
export default function PronunciationPage(props: Props) {
  return (
    <Suspense fallback={<PronunciationSkeleton />}>
      <PronunciationContent {...props} />
    </Suspense>
  );
}
