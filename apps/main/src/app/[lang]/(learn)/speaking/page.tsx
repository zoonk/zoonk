import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { redirect } from "@/i18n/navigation";
import { getLanguageProgressView } from "@zoonk/core/view-models/language/progress";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { SpeakingClient } from "./speaking-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Speaking practice") };
}

async function SpeakingContent() {
  const [language, result] = await Promise.all([lang(), getLanguageProgressView({})]);

  if (result.status === "noGoal" || result.status === "unauthorized") {
    return (
      <>
        <JourneyPageBar />
        <LearnNoGoal />
      </>
    );
  }

  // An exam goal practices its speaking paper on its exam page.
  if (result.status === "notLanguage") {
    redirect({ href: "/exam", locale: language });
  }

  if (result.status !== "ready" || !result.progress.speaking) {
    notFound();
  }

  return <SpeakingClient goalId={result.progress.goal.id} paper={result.progress.speaking} />;
}

function SpeakingSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <JourneyPageBar />
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-48" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
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
