import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { MockChooserClient } from "../../mock-chooser-client";

type Props = PageProps<"/[lang]/mock/placement/[goalId]">;

/** A learner's own mock: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("A mock exam to find your level") };
}

function PlacementMockSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-full" />
    </main>
  );
}

async function PlacementMockContent({ params }: Props) {
  const { goalId, lang } = await params;
  const onboarding = `/start/${goalId}` as const;
  const result = isUuid(goalId) ? await getMockOptions({ goalId }) : null;

  if (result?.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  const placement = result?.status === "ready" ? result.view.placement : null;

  // A goal that isn't an exam, or one already past it: the quick placement goes on.
  if (result?.status !== "ready" || !placement || placement.mock?.status === "finished") {
    redirect({ href: onboarding, locale: lang });
    return null;
  }

  if (placement.mock) {
    redirect({ href: `/mock/${placement.mock.id}`, locale: lang });
  }

  return (
    <MainLearnProvider>
      <MockChooserClient
        page={{ exitHref: onboarding, goalId, placement: true }}
        view={result.view}
      />
    </MainLearnProvider>
  );
}

/**
 * A diagnostic mock in onboarding, instead of the quick questions: the lengths it comes in with
 * their real size and time, why it helps, and Start (or, without Plus, what it takes). Its answers
 * set where the plan starts; stopping midway keeps them.
 */
export default function PlacementMockPage(props: Props) {
  return (
    <Suspense fallback={<PlacementMockSkeleton />}>
      <PlacementMockContent {...props} />
    </Suspense>
  );
}
