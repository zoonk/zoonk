import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { MockChooserClient } from "../mock-chooser-client";

/** A learner's own mock: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Take a mock exam") };
}

function MockChooserSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-44 w-full rounded-3xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-full" />
    </main>
  );
}

async function MockChooserContent() {
  // The root param, not `params`: a prefetch warms its caches with `params` still pending.
  const [locale, result] = await Promise.all([lang(), getMockOptions()]);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale });
  }

  // Only an exam goal has mocks: anything else goes back to the day.
  if (result.status !== "ready") {
    redirect({ href: "/today", locale });
    return null;
  }

  const { view } = result;

  // One at a time: a mock left running is where the learner goes on.
  if (view.running) {
    redirect({ href: `/mock/${view.running.id}`, locale });
  }

  // No mock can be built yet (a class test with no material): the exam page says what there is.
  if (view.options.length === 0) {
    redirect({ href: "/exam", locale });
  }

  return (
    <MainLearnProvider>
      <MockChooserClient
        page={{ exitHref: "/exam", goalId: view.goalId, placement: false }}
        view={view}
      />
    </MainLearnProvider>
  );
}

/**
 * "Take a mock exam" for the active exam goal, whenever the learner wants: the full exam, half of
 * it or one subject, each with its honest time. Opened from the exam, the Journey and Today.
 */
export default function MockChooserPage() {
  return (
    <Suspense fallback={<MockChooserSkeleton />}>
      <MockChooserContent />
    </Suspense>
  );
}
