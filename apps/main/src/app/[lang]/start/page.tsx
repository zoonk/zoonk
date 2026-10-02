import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getExperienceMode } from "@/lib/learn/experience-mode";
import { GOAL_PARAM, PLAN_PARAM } from "@/lib/public/public-hrefs";
import { getSession } from "@zoonk/core/users/session";
import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboardingDraft } from "@zoonk/core/view-models/onboarding/get-draft";
import { DeviceModeRoot } from "@zoonk/learn/mode";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { StartClient } from "./start-client";
import { DRAFT_PARAM, START_AGAIN_PARAM } from "./start-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Write what you want to achieve in your own words. Zoonk asks only what's missing and builds a plan for your time. Free to start, no account needed.",
    ),
    title: t("Start with your goal"),
  };
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

/** The draft in the address when it's the visitor's own; anyone else's, or none, starts fresh. */
async function loadDraft(draftId: string | null): Promise<OnboardingDraftView | null> {
  if (!draftId || !isUuid(draftId)) {
    return null;
  }

  const result = await getOnboardingDraft({ draftId });
  return result.status === "ready" ? result.draft : null;
}

async function StartContent({ searchParams }: PageProps<"/[lang]/start">) {
  const [language, query] = await Promise.all([lang(), searchParams]);

  const [mode, session, draft] = await Promise.all([
    getExperienceMode(),
    getSession(),
    loadDraft(readParam(query[DRAFT_PARAM])),
  ]);

  // Once goals were created from the draft, its onboarding goes on at the goal.
  if (draft?.goalId) {
    redirect({ href: `/start/${draft.goalId}`, locale: language });
  }

  const plan = readParam(query[PLAN_PARAM]);

  return (
    <MainLearnProvider>
      <StartClient
        // "Start over" comes back here with a new key, so nothing typed before is kept, and
        // opening another draft shows that one.
        key={`${readParam(query[START_AGAIN_PARAM]) ?? "start"}:${draft?.id ?? ""}`}
        canAttach={Boolean(session && !session.user.isAnonymous)}
        defaultGoal={readParam(query[GOAL_PARAM]) ?? ""}
        initialDraft={draft}
        initialMode={mode}
        planId={plan && isUuid(plan) ? plan : null}
      />
    </MainLearnProvider>
  );
}

function StartSkeleton() {
  return (
    <DeviceModeRoot>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pt-24 sm:pt-32">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-16 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </main>
    </DeviceModeRoot>
  );
}

/**
 * Onboarding starts here: the goal in the learner's own words, understood and confirmed. The goal
 * being confirmed stays in the address (`?draft=`), so a refresh shows the same screen. Links send
 * visitors here with `?goal=` filled in; it only fills the box, since reading a goal starts from
 * the learner's own tap.
 */
export default function StartPage(props: PageProps<"/[lang]/start">) {
  return (
    <Suspense fallback={<StartSkeleton />}>
      <StartContent {...props} />
    </Suspense>
  );
}
