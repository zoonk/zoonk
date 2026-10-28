import { LoginBarLink } from "@/components/login-bar-link";
import { redirect } from "@/i18n/navigation";
import { GOAL_PARAM, PLAN_PARAM } from "@/lib/public/public-hrefs";
import { OnboardingPage } from "@zoonk/learn/onboarding/frame";
import { StartEntrySkeleton } from "@zoonk/learn/onboarding/skeletons";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { StartClient } from "./start-client";
import { DRAFT_PARAM, START_AGAIN_PARAM } from "./start-params";
import { StartSkeleton } from "./start-skeleton";
import { loadStartView } from "./start-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Write what you want to achieve in your own words. Zoonk asks only what's missing and builds a plan for your time. Start free, no account needed.",
    ),
    title: t("Start with your goal"),
  };
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

async function StartContent({ searchParams }: PageProps<"/[lang]/start">) {
  const [language, query] = await Promise.all([lang(), searchParams]);

  const { canAttach, draft, goalLimit, hasSession, needsAccount } = await loadStartView(
    readParam(query[DRAFT_PARAM]),
  );

  if (draft?.goalId) {
    redirect({ href: `/start/${draft.goalId}`, locale: language });
  }

  const plan = readParam(query[PLAN_PARAM]);

  return (
    <OnboardingPage
      backHref={hasSession ? "/today" : "/"}
      barEnd={hasSession ? null : <LoginBarLink className="lg:hidden" />}
    >
      <StartClient
        // "Start over" comes back here with a new key, so nothing typed before is kept, and
        // opening another draft shows that one.
        key={`${readParam(query[START_AGAIN_PARAM]) ?? "start"}:${draft?.id ?? ""}`}
        canAttach={canAttach}
        defaultGoal={readParam(query[GOAL_PARAM]) ?? ""}
        goalLimit={goalLimit}
        initialDraft={draft}
        needsAccount={needsAccount}
        planId={plan && isUuid(plan) ? plan : null}
      />
    </OnboardingPage>
  );
}

/** `?goal=` only fills the box: reading a goal starts from the learner's own tap. */
export default function StartPage(props: PageProps<"/[lang]/start">) {
  // The skeleton follows the address (a goal on its way shows the wait's shape), which the
  // prerendered page doesn't know: there it's the first screen's.
  return (
    <Suspense
      fallback={
        <OnboardingPage backHref="/today">
          <Suspense fallback={<StartEntrySkeleton />}>
            <StartSkeleton />
          </Suspense>
        </OnboardingPage>
      }
    >
      <StartContent {...props} />
    </Suspense>
  );
}
