import { LearnNoGoal } from "@/app/[lang]/(app)/(learn)/_components/learn-no-goal";
import { MockChooserClient } from "@/app/[lang]/mock/mock-chooser-client";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { redirect } from "@/i18n/navigation";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { LearnPageBar } from "@zoonk/learn/bar";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

type Props = PageProps<"/[lang]/mock/placement/[goalId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("A mock exam to find your level") };
}

async function PlacementBar({ backHref }: { backHref: string }) {
  const t = await getExtracted();

  return (
    <LearnPageBar
      back={{ href: backHref, label: t("Your plan") }}
      title={t("A mock exam to find your level")}
    />
  );
}

async function PlacementMockContent({ params }: Props) {
  const { goalId, lang } = await params;
  const onboarding = `/start/${goalId}` as const;
  const result = isUuid(goalId) ? await getMockOptions({ goalId }) : null;

  if (result?.status === "unauthorized") {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={<PlacementBar backHref={onboarding} />}
        description={t("Mock exam, timed like the real one")}
        next={`/mock/placement/${goalId}`}
        title={t("A mock exam to find your level")}
      />
    );
  }

  const placement = result?.status === "ready" ? result.view.placement : null;

  if (result?.status !== "ready" || !placement || placement.mock?.status === "finished") {
    redirect({ href: onboarding, locale: lang });
    return null;
  }

  if (placement.mock) {
    redirect({ href: `/mock/${placement.mock.id}`, locale: lang });
  }

  return (
    <MockChooserClient
      bar={<PlacementBar backHref={onboarding} />}
      page={{ goalId, placement: true }}
      view={result.view}
    />
  );
}

async function PlacementMockSkeleton() {
  const t = await getExtracted();

  return (
    <DetailSkeleton
      aside={false}
      bar={<PlacementBar backHref="/today" />}
      rows={3}
      title={t("A mock exam to find your level")}
    />
  );
}

export default function PlacementMockPage(props: Props) {
  return (
    <Suspense fallback={<PlacementMockSkeleton />}>
      <PlacementMockContent {...props} />
    </Suspense>
  );
}
