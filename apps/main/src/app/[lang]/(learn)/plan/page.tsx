import { MainAskTutor } from "@/components/learn/main-ask-tutor";
import { UploadRequestSection } from "@/components/learn/upload-request-section";
import { getCourseHref } from "@/data/courses/course-href";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { getPathname } from "@/i18n/navigation";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getSession } from "@zoonk/core/users/session";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import {
  changeOwnLevelAction,
  changePlanAction,
  choosePlanToolsAction,
  decidePlanChangeAction,
  requestPlanEditAction,
} from "./plan-actions";
import { PlanBuildingClient, PlanScreenClient } from "./plan-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Plan") };
}

async function PlanContent() {
  // Independent cached reads start together, so the tab prefetches in one pass. The locale comes
  // from the root param: a prefetch warms its caches with `params` still pending, so reads after
  // `await params` would miss the cache.
  const [result, buddy, session, language] = await Promise.all([
    getPlanTabView(),
    getLearnerBuddy(),
    getSession(),
    lang(),
  ]);

  if (result.status === "noGoal" || result.status === "unauthorized") {
    return <LearnNoGoal />;
  }

  if (result.status !== "ready") {
    notFound();
  }

  const { goal, plan } = result.view;
  const { course } = plan;
  const canAsk = Boolean(session && !session.user.isAnonymous);

  if (!plan.ready) {
    return <PlanBuildingClient goalId={goal.id} />;
  }

  // "Ask" opens the player's questions sheet, so the plan needs the player's messages.
  return (
    <ClientMessagesProvider scope="player">
      {/* Asked once the plan exists, so an upload rebuilds it instead of racing its first build. */}
      <UploadRequestSection className="mb-6" goalId={goal.id} />
      <PlanScreenClient
        actions={{
          change: changePlanAction.bind(null, goal.id),
          changeLevel: changeOwnLevelAction.bind(null, goal.id),
          chooseTools: choosePlanToolsAction.bind(null, goal.id),
          decide: decidePlanChangeAction.bind(null, goal.id),
          requestEdit: requestPlanEditAction.bind(null, goal.id),
        }}
        chapterBasePath="/content/chapters"
        courseHref={
          course?.brandSlug
            ? getCourseHref({ brandSlug: course.brandSlug, courseSlug: course.courseSlug })
            : null
        }
        goal={{ kind: goal.kind, title: goal.title }}
        mapHref="/content/map"
        buddy={buddy}
        plan={plan}
        shareHref={getPathname({
          href: `/plan-link/${plan.planId}`,
          locale: getSupportedLocaleFromLanguage(language),
        })}
        testOutBasePath="/plan/test-out"
        tutor={<MainAskTutor canAsk={canAsk} target={{ goalId: goal.id, kind: "plan" }} />}
      />
    </ClientMessagesProvider>
  );
}

function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-9 w-2/3" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

/** The plan for the goal in the switcher, at three zoom levels (the Route in Fun). */
export default function PlanPage() {
  return (
    <Suspense fallback={<PlanSkeleton />}>
      <PlanContent />
    </Suspense>
  );
}
