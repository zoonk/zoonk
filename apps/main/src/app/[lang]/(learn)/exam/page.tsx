import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { getExamView } from "@zoonk/core/exams/view/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { ExamScreenClient } from "./exam-screen-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Your exam") };
}

async function ExamContent() {
  // Both read the active goal; they start together so the page prefetches in one pass.
  const [result, mocks] = await Promise.all([getExamView({}), getMockOptions()]);

  if (result.status === "noGoal" || result.status === "unauthorized") {
    return (
      <>
        <JourneyPageBar />
        <LearnNoGoal />
      </>
    );
  }

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <ExamScreenClient exam={result.exam} mocks={mocks.status === "ready" ? mocks.view : null} />
  );
}

function ExamSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <JourneyPageBar />
        <div className="flex items-center gap-4">
          <Skeleton className="h-21 w-16 rounded-2xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-48" />
          </div>
        </div>
        <Skeleton className="h-8 w-64 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

/**
 * "About the exam" for the active exam goal: its days, the next mock exam, what's on it, how it's
 * scored, the mocks so far and the result after.
 */
export default function ExamPage() {
  return (
    <Suspense fallback={<ExamSkeleton />}>
      <ExamContent />
    </Suspense>
  );
}
