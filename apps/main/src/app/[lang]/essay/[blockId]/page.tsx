import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { redirect } from "@/i18n/navigation";
import { getExperienceMode } from "@/lib/learn/experience-mode";
import { getEssay } from "@zoonk/core/exams/essays/get";
import { DeviceModeRoot, ModeProvider } from "@zoonk/learn/mode";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EssayClient } from "./essay-client";

type Props = PageProps<"/[lang]/essay/[blockId]">;

/** An essay is one learner's own writing: nothing here is for search. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Writing practice") };
}

function EssaySkeleton() {
  return (
    <DeviceModeRoot>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </main>
    </DeviceModeRoot>
  );
}

async function EssayContent({ params }: Props) {
  const { blockId, lang } = await params;

  const [result, mode] = await Promise.all([getEssay({ blockId }), getExperienceMode()]);

  if (result.status === "unauthorized") {
    redirect({ href: "/login", locale: lang });
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <ModeProvider experienceMode={mode}>
      <MainLearnProvider>
        <EssayClient essay={result.essay} />
      </MainLearnProvider>
    </ModeProvider>
  );
}

/** A writing block of today's session: an exam essay graded by the official rubric. */
export default function EssayPage(props: Props) {
  return (
    <Suspense fallback={<EssaySkeleton />}>
      <EssayContent {...props} />
    </Suspense>
  );
}
