import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getPronunciationReviews } from "@zoonk/core/language/pronunciation/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
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
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-56 w-full rounded-3xl" />
      <Skeleton className="mx-auto size-20 rounded-full" />
      <Skeleton className="mt-auto h-14 w-full rounded-full" />
    </main>
  );
}

async function PronunciationContent({ params, searchParams }: Props) {
  const [{ lang }, { goal }] = await Promise.all([params, searchParams]);
  const goalId = typeof goal === "string" && isUuid(goal) ? goal : undefined;

  const result = await getPronunciationReviews({ goalId });

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
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
