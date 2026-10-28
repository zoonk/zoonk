import { MockChooserClient } from "@/app/[lang]/mock/mock-chooser-client";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { redirect } from "@/i18n/navigation";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { LearnPageBar } from "@zoonk/learn/bar";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { LearnNoGoal } from "../../_components/learn-no-goal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Take a mock exam") };
}

const CHOOSER_BAR = <LearnPageBar back={{ href: "/exam" }} root />;

async function MockChooserContent() {
  // The root param, not `params`: a prefetch warms its caches with `params` still pending.
  const [locale, result] = await Promise.all([lang(), getMockOptions()]);

  if (result.status === "unauthorized") {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={CHOOSER_BAR}
        description={t("Mock exam, timed like the real one")}
        next="/mock/new"
        title={t("Take a mock exam")}
      />
    );
  }

  if (result.status !== "ready") {
    redirect({ href: "/today", locale });
    return null;
  }

  const { view } = result;

  // One at a time: a mock left running is where the learner goes on.
  if (view.running) {
    redirect({ href: `/mock/${view.running.id}`, locale });
  }

  if (view.options.length === 0) {
    redirect({ href: "/exam", locale });
  }

  return (
    <MockChooserClient
      bar={CHOOSER_BAR}
      page={{ goalId: view.goalId, placement: false }}
      view={view}
    />
  );
}

async function MockChooserSkeleton() {
  const t = await getExtracted();
  return <DetailSkeleton bar={CHOOSER_BAR} rows={6} title={t("Take a mock exam")} />;
}

export default function MockChooserPage() {
  return (
    <Suspense fallback={<MockChooserSkeleton />}>
      <MockChooserContent />
    </Suspense>
  );
}
