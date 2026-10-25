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
import { getGoalPlan } from "@zoonk/core/plans/get";
import { getSession } from "@zoonk/core/users/session";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingFrame,
  OnboardingHeading,
  OnboardingPage,
  OnboardingTitle,
} from "@zoonk/learn/onboarding/frame";
import { StepsSkeleton } from "@zoonk/learn/onboarding/skeletons";
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

/**
 * Someone without a session (a guest whose session ended, another device): the page keeps a
 * header saying what it is, and the way in under it, back to these questions.
 */
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

  const [result, session] = await Promise.all([getOnboarding({ goalId }), getSession()]);

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

  // The reveal is only used on the plan screen. A planner failure must not block earlier answers.
  const [plan, syllabus] =
    (result.onboarding.steps[0] ?? "plan") === "plan"
      ? await Promise.all([getGoalPlan(goalId), getSyllabusView({ goalId })])
      : [null, null];

  return (
    <OnboardingPage backHref="/today">
      <StepsClient
        initialPlan={
          plan?.status === "ready"
            ? { plan: plan.plan, syllabus: syllabus?.status === "ready" ? syllabus.syllabus : null }
            : null
        }
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

/**
 * The rest of onboarding for a goal the learner just created, ending with its plan, as a page of
 * the app's frame.
 */
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
