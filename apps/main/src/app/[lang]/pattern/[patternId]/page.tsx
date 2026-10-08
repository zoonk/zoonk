import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getMistakePattern } from "@zoonk/core/language/patterns/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PatternClient } from "./pattern-client";

type Props = PageProps<"/[lang]/pattern/[patternId]">;

/** A pattern is one learner's own mistakes: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Mistake pattern") };
}

function PatternSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="size-12 rounded-2xl" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-48 w-full rounded-3xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-full" />
    </main>
  );
}

async function PatternContent({ params }: Props) {
  const { lang, patternId } = await params;

  const result = await getMistakePattern(patternId);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <MainLearnProvider>
      <PatternClient pattern={result.pattern} />
    </MainLearnProvider>
  );
}

/**
 * "We noticed a pattern", full screen like a checkpoint: the rule behind a few recent mistakes,
 * then a three-minute drill, or the kind note when they were only typos.
 */
export default function PatternPage(props: Props) {
  return (
    <Suspense fallback={<PatternSkeleton />}>
      <PatternContent {...props} />
    </Suspense>
  );
}
