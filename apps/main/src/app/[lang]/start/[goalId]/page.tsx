import {
  changePlanAction,
  choosePlanToolsAction,
  decidePlanChangeAction,
  requestPlanEditAction,
} from "@/app/[lang]/(learn)/plan/plan-actions";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { isUnderMinimumAge } from "@/lib/guest/minimum-age";
import { getDeviceExperienceMode, getExperienceMode } from "@/lib/learn/experience-mode";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { getSession } from "@zoonk/core/users/session";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { DeviceModeRoot } from "@zoonk/learn/mode";
import { OnboardingChromeProvider } from "@zoonk/learn/onboarding/frame";
import { TooYoungScreen } from "@zoonk/learn/onboarding/too-young";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { VisitorTopBar } from "../_components/start-chrome";
import { StepsClient } from "./steps-client";

type Props = PageProps<"/[lang]/start/[goalId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Your plan") };
}

async function StepsContent({ params }: Props) {
  // Every read here is the learner's own and changes with each answer: render per request.
  await connection();
  const { goalId, lang } = await params;

  if (!isUuid(goalId)) {
    notFound();
  }

  const [result, plan, savedMode, deviceMode, session, buddy] = await Promise.all([
    getOnboarding({ goalId }),
    getGoalPlan(goalId),
    getExperienceMode(),
    getDeviceExperienceMode(),
    getSession(),
    getLearnerBuddy(),
  ]);

  // Right after an under-13 answer deletes the account, the page renders once more without it,
  // under the visitor's bar: the account is gone, whatever the layout's bar read before.
  if (result.status !== "ready" && (await isUnderMinimumAge())) {
    return (
      <MainLearnProvider>
        <OnboardingChromeProvider chrome={<VisitorTopBar />}>
          <TooYoungScreen mode={deviceMode} />
        </OnboardingChromeProvider>
      </MainLearnProvider>
    );
  }

  if (result.status === "unauthorized") {
    redirect({ href: "/start", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  if (result.onboarding.goal.kind === "explain") {
    redirect({ href: `/explain/${goalId}`, locale: lang });
  }

  // Until this onboarding asks for the mode, the saved one is only the default, so the screens
  // keep the look the visitor already had on this device.
  const choosesMode = result.onboarding.steps.includes("mode");

  return (
    <MainLearnProvider>
      <StepsClient
        initialMode={choosesMode ? deviceMode : savedMode}
        initialPlan={plan.status === "ready" ? plan.plan : null}
        isGuest={Boolean(session?.user.isAnonymous)}
        onboarding={result.onboarding}
        buddy={buddy}
        planActions={{
          change: changePlanAction.bind(null, goalId),
          chooseTools: choosePlanToolsAction.bind(null, goalId),
          decide: decidePlanChangeAction.bind(null, goalId),
          requestEdit: requestPlanEditAction.bind(null, goalId),
        }}
      />
    </MainLearnProvider>
  );
}

function StepsSkeleton() {
  return (
    <DeviceModeRoot>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pt-20">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </main>
    </DeviceModeRoot>
  );
}

/** The rest of onboarding for a goal the learner just created, ending with its plan. */
export default function OnboardingStepsPage(props: Props) {
  return (
    <Suspense fallback={<StepsSkeleton />}>
      <StepsContent {...props} />
    </Suspense>
  );
}
