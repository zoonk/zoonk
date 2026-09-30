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
  const result = await getExamView({});

  if (result.status === "noGoal" || result.status === "unauthorized") {
    return <LearnNoGoal />;
  }

  if (result.status !== "ready") {
    notFound();
  }

  return <ExamScreenClient exam={result.exam} />;
}

function ExamSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

/** The active exam goal's screen: its days, the exam map, scoring, mocks and the result after. */
export default function ExamPage() {
  return (
    <Suspense fallback={<ExamSkeleton />}>
      <ExamContent />
    </Suspense>
  );
}
