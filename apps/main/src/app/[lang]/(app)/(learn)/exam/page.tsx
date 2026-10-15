import { NotFoundPage } from "@/components/errors/not-found-page";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { getExamView } from "@zoonk/core/exams/view/get";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { LearnNotFound } from "../_components/learn-not-found";
import { ExamScreenClient } from "./exam-screen-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Your exam") };
}

async function ExamContent() {
  // Both read the active goal; they start together so the page prefetches in one pass.
  const [result, mocks] = await Promise.all([getExamView({}), getMockOptions()]);

  if (result.status === "noGoal" || result.status === "unauthorized") {
    const t = await getExtracted();

    return (
      <>
        <LearnerWitness />

        <LearnNoGoal
          bar={<JourneyPageBar root />}
          description={t("Your exam's areas, how ready you are for each, and its mock exams.")}
          next="/exam"
          title={t("Your exam")}
        />
      </>
    );
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnerWitness />
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  return (
    <>
      <LearnerWitness />

      <ExamScreenClient exam={result.exam} mocks={mocks.status === "ready" ? mocks.view : null} />
    </>
  );
}

/**
 * "About the exam" for the active exam goal: its days, the next mock exam, what's on it, how it's
 * scored, the mocks so far and the result after.
 */
export default function ExamPage() {
  return (
    <Suspense fallback={<DetailSkeleton bar={<JourneyPageBar root />} rows={3} />}>
      <ExamContent />
    </Suspense>
  );
}
