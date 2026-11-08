import {
  changePlanAction,
  chooseExamOptionAction,
  choosePlanToolsAction,
  decidePlanChangeAction,
  previewPlanChangeAction,
} from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { AuthGate } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { LoginBarLink } from "@/components/login-bar-link";
import { redirect } from "@/i18n/navigation";
import { getGoalWarmUp } from "@zoonk/core/library/warm-ups/get";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { getSession } from "@zoonk/core/users/session";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { getPlanRevealToday } from "@zoonk/core/view-models/today/plan-reveal";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFrame,
  OnboardingHeading,
  OnboardingPage,
  OnboardingTitle,
} from "@zoonk/learn/onboarding/frame";
import { StepsSkeleton } from "@zoonk/learn/onboarding/skeletons";
import { safeAsync } from "@zoonk/utils/error";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { OnboardingNotFound } from "../../_components/onboarding-not-found";
import { StepsClient } from "./steps-client";

type Props = PageProps<"/[lang]/start/[goalId]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Your plan") };
}

async function StepsGate({ goalId }: { goalId: string }) {
  const t = await getExtracted();

  return (
    <OnboardingPage backHref="/" barEnd={<LoginBarLink className="lg:hidden" />}>
      <OnboardingFrame>
        <OnboardingColumn>
          <OnboardingHeading>
            <OnboardingTitle>{t("Your plan")}</OnboardingTitle>
            <OnboardingDescription>
              {t("What you'll study each day until your goal, and what it covers.")}
            </OnboardingDescription>
          </OnboardingHeading>

          <AuthGate next={`/start/${goalId}`} />
        </OnboardingColumn>
      </OnboardingFrame>
    </OnboardingPage>
  );
}

async function StepsContent({ params }: Props) {
  // Every read here is the learner's own and changes with each answer: render per request.
  await connection();
  const { goalId, lang } = await params;

  if (!isUuid(goalId)) {
    return (
      <NotFoundPage>
        <OnboardingNotFound />
      </NotFoundPage>
    );
  }

  // A deck that can't be read leaves the wait without its card until the run names one.
  const [result, session, deck] = await Promise.all([
    getOnboarding({ goalId }),
    getSession(),
    safeAsync(() => getGoalWarmUp(goalId)),
  ]);

  if (result.status === "unauthorized") {
    return <StepsGate goalId={goalId} />;
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <OnboardingNotFound />
      </NotFoundPage>
    );
  }

  if (result.onboarding.goal.kind === "explain") {
    redirect({ href: `/explain/${goalId}`, locale: lang });
  }

  // A planner failure must not block the earlier answers.
  const [plan, syllabus, today] =
    (result.onboarding.steps[0] ?? "plan") === "plan"
      ? await Promise.all([
          getGoalPlan(goalId),
          getSyllabusView({ goalId }),
          getPlanRevealToday(goalId),
        ])
      : [null, null, null];

  return (
    <OnboardingPage backHref="/today">
      <StepsClient
        initialPlan={
          plan?.status === "ready"
            ? {
                plan: plan.plan,
                syllabus: syllabus?.status === "ready" ? syllabus.syllabus : null,
                today: today?.status === "ready" ? today.session : null,
              }
            : null
        }
        deck={deck.data ?? null}
        isGuest={Boolean(session?.user.isAnonymous)}
        onboarding={result.onboarding}
        planActions={{
          change: changePlanAction.bind(null, goalId),
          chooseExamOption: chooseExamOptionAction.bind(null, goalId),
          chooseTools: choosePlanToolsAction.bind(null, goalId),
          decide: decidePlanChangeAction.bind(null, goalId),
          preview: previewPlanChangeAction.bind(null, goalId),
        }}
      />
    </OnboardingPage>
  );
}

export default function OnboardingStepsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <OnboardingPage backHref="/today">
          <StepsSkeleton />
        </OnboardingPage>
      }
    >
      <StepsContent {...props} />
    </Suspense>
  );
}
