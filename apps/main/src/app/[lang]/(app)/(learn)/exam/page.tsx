import { NotFoundPage } from "@/components/errors/not-found-page";
import {
  DetailSkeleton,
  ListSectionSkeleton,
  SectionLabelSkeleton,
} from "@/components/learn/detail-skeleton";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { getExamView } from "@zoonk/core/exams/view/get";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
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
      <LearnNoGoal
        bar={<JourneyPageBar root />}
        description={t("Your exam's areas, how ready you are for each, and its mock exams.")}
        next="/exam"
        title={t("Your exam")}
      />
    );
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  return (
    <ExamScreenClient exam={result.exam} mocks={mocks.status === "ready" ? mocks.view : null} />
  );
}

/** A number's tile while the page loads, as `StatTile` draws it: its label, the number and its line. */
function StatTileSkeleton() {
  return (
    <div className="ring-border rounded-option flex flex-col gap-2.5 p-3 ring-1 ring-inset">
      <Skeleton className="h-3 w-20 rounded-sm" />
      <Skeleton className="h-6 w-14 rounded-sm" />
      <Skeleton className="h-3 w-28 max-w-full rounded-sm" />
    </div>
  );
}

/** A subject's score while the page loads: its name, its bar and its percent. */
function SubjectRowSkeleton() {
  return (
    <div className="flex h-11 items-center gap-3">
      <span className="flex-1">
        <Skeleton className="h-3.5 w-32 max-w-full rounded-sm" />
      </span>
      <Skeleton className="h-1 w-20 rounded-[2px] sm:w-36" />
      <Skeleton className="h-3 w-8 rounded-sm" />
    </div>
  );
}

/** How the mocks went while the page loads: the two numbers' tiles over each subject's score. */
function MockProgressSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabelSkeleton />
      <div className="grid grid-cols-2 gap-2">
        <StatTileSkeleton />
        <StatTileSkeleton />
      </div>
      <div className="mt-1 flex flex-col [&>*+*]:border-t">
        <SubjectRowSkeleton />
        <SubjectRowSkeleton />
      </div>
    </div>
  );
}

/** The aside while the page loads, from 72rem: the exam's days, then how the score works. */
function ExamAsideSkeleton() {
  return (
    <div className="hidden flex-col gap-8 min-[72rem]:flex">
      <ListSectionSkeleton rows={2} />
      <div className="flex flex-col gap-3">
        <SectionLabelSkeleton />
        <div className={cn(SURFACE_CLASS, "flex flex-col gap-2 p-4")}>
          <Skeleton className="h-3.5 w-40 max-w-full rounded-sm" />
          <Skeleton className="h-3 w-full rounded-sm" />
          <Skeleton className="h-3 w-2/3 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

/**
 * The exam's shape while it loads: its header, its mocks as rows, how they went (the two numbers'
 * tiles over each subject's bar) and, from 72rem, the aside's exam days and the score's panel, so
 * nothing moves when the page arrives.
 */
function ExamSkeleton() {
  return (
    <DetailSkeleton aside={<ExamAsideSkeleton />} bar={<JourneyPageBar root />}>
      <ListSectionSkeleton rows={2} />
      <MockProgressSkeleton />
    </DetailSkeleton>
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
