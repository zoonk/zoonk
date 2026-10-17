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

/** A learner's own mock: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Take a mock exam") };
}

/**
 * Opened from the exam, the Plan and Today's practice: its way back returns to whichever it was,
 * or to the exam, and the sidebar says where it is from `lg`.
 */
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
    <MockChooserClient
      bar={CHOOSER_BAR}
      page={{ goalId: view.goalId, placement: false }}
      view={view}
    />
  );
}

/** The chooser while it loads, in its page's shape: its title, its main action and the options. */
async function MockChooserSkeleton() {
  const t = await getExtracted();
  return <DetailSkeleton bar={CHOOSER_BAR} rows={6} title={t("Take a mock exam")} />;
}

/**
 * "Take a mock exam" for the active exam goal, whenever the learner wants, as a page of the app's
 * frame: the full exam, half of it or one subject, each with its honest time. Opened from the
 * exam, the Plan and Today; the mock itself runs full screen.
 */
export default function MockChooserPage() {
  return (
    <Suspense fallback={<MockChooserSkeleton />}>
      <MockChooserContent />
    </Suspense>
  );
}
