import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getExperienceMode } from "@/lib/learn/experience-mode";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getWeeklyRecap } from "@zoonk/core/milestones/weekly-recap";
import { getSession } from "@zoonk/core/users/session";
import { LogbookScreen } from "@zoonk/learn/logbook";
import { DeviceModeRoot, ModeProvider } from "@zoonk/learn/mode";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { Suspense } from "react";

/** The week of one learner: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Logbook") };
}

function LogbookSkeleton() {
  return (
    <DeviceModeRoot>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
        <Skeleton className="h-1 w-full rounded-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-28 w-full rounded-3xl" />
      </main>
    </DeviceModeRoot>
  );
}

async function LogbookContent() {
  // The root param, not `params`: a prefetch warms its caches with `params` still pending.
  const [language, goal, session, mode, buddy] = await Promise.all([
    lang(),
    getCurrentGoal(),
    getSession(),
    getExperienceMode(),
    getLearnerBuddy(),
  ]);

  const result = await getWeeklyRecap({ goalId: goal?.id });

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: language });
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <ModeProvider experienceMode={mode}>
      <MainLearnProvider>
        <LogbookScreen
          hrefs={{ close: mode === "fun" ? "/buddy" : "/progress", start: "/today" }}
          learnerName={session?.user.name.split(" ")[0] || null}
          buddy={buddy}
          recap={result.recap}
        />
      </MainLearnProvider>
    </ModeProvider>
  );
}

/** The week's recap: Fun's Sunday logbook, told as a short story, or Focus's weekly summary. */
export default function LogbookPage() {
  return (
    <Suspense fallback={<LogbookSkeleton />}>
      <LogbookContent />
    </Suspense>
  );
}
