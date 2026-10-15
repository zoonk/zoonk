import { NotFoundPage } from "@/components/errors/not-found-page";
import { redirect } from "@/i18n/navigation";
import { getSpeakingPaper } from "@zoonk/core/language/exam-speaking/paper";
import { LearnPageBar } from "@zoonk/learn/bar";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { LearnNotFound } from "../_components/learn-not-found";
import { SpeakingClient } from "./speaking-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Speaking practice") };
}

/**
 * The page's bar while it loads or has no goal to show, as the practice draws it: back to the page
 * the learner came from (Today without one), none from `lg`, where the sidebar lists it.
 */
async function SpeakingBar() {
  const t = await getExtracted();
  return <LearnPageBar back={{ href: "/today" }} root title={t("Speaking practice")} />;
}

async function SpeakingContent() {
  const [language, result] = await Promise.all([lang(), getSpeakingPaper({})]);

  if (result.status === "noGoal" || result.status === "unauthorized") {
    const t = await getExtracted();

    return (
      <>
        <SpeakingBar />
        <LearnNoGoal
          description={t("Calls in the language you're learning, at your level.")}
          next="/speaking"
          title={t("Speaking practice")}
        />
      </>
    );
  }

  // An exam goal practices its speaking paper on its exam page.
  if (result.status === "notLanguage") {
    redirect({ href: "/exam", locale: language });
  }

  if (result.status !== "ready" || !result.paper) {
    return (
      <NotFoundPage>
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  return <SpeakingClient goalId={result.goalId} paper={result.paper} />;
}

function SpeakingSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <SpeakingBar />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * A language goal's speaking practice in an exam's format at the level it aims for, from Today's
 * "Practice anytime" and the level sheet: its tasks, one at a time, and their last results.
 */
export default function SpeakingPage() {
  return (
    <Suspense fallback={<SpeakingSkeleton />}>
      <SpeakingContent />
    </Suspense>
  );
}
