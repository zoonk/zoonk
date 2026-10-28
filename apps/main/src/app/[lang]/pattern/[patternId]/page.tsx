import { AuthGateScreen } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { TaskNotFound } from "@/components/learn/task-not-found";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getMistakePattern } from "@zoonk/core/language/patterns/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { PatternClient } from "./pattern-client";

type Props = PageProps<"/[lang]/pattern/[patternId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Mistake pattern") };
}

function PatternSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
      <Skeleton className="size-9 rounded-lg" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36 rounded-md" />
        <Skeleton className="h-8 w-2/3 rounded-lg" />
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="mt-auto h-11 w-full rounded-lg" />
    </main>
  );
}

async function PatternContent({ params }: Props) {
  const { patternId } = await params;

  const [result, buddy] = await Promise.all([getMistakePattern(patternId), getLearnerBuddy()]);

  if (result.status === "unauthorized") {
    return <AuthGateScreen next={`/pattern/${patternId}`} />;
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
      <PatternClient buddy={buddy} pattern={result.pattern} />
    </MainLearnProvider>
  );
}

export default function PatternPage(props: Props) {
  return (
    <Suspense fallback={<PatternSkeleton />}>
      <PatternContent {...props} />
    </Suspense>
  );
}
