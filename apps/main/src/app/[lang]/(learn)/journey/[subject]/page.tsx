import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../../_components/learn-no-goal";
import { SubjectScreenClient } from "./subject-screen-client";

type Props = PageProps<"/[lang]/journey/[subject]">;

/** The subject on this page, from the active goal's syllabus; null when it has no such subject. */
async function findSubject(key: string) {
  const result = await getSyllabusView();

  if (result.status !== "ready") {
    return { result, subject: null };
  }

  return {
    result,
    subject: result.syllabus.subjects.find((subject) => subject.key === key) ?? null,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ subject: key }, t] = await Promise.all([params, getExtracted()]);
  const { subject } = await findSubject(decodeURIComponent(key));

  return { title: subject?.shortName ?? t("Journey") };
}

/** Whether one of the subject's chapters is on the goal's mind maps page (it has or can get one). */
function hasSubjectMindMaps({
  mindMaps,
  subject,
}: {
  mindMaps: Awaited<ReturnType<typeof listGoalMindMaps>>;
  subject: SyllabusSubject;
}): boolean {
  if (mindMaps.status !== "ready") {
    return false;
  }

  const listed = new Set(mindMaps.mindMaps.chapters.map((chapter) => chapter.chapterId));
  return subject.chapters.some((chapter) => chapter.chapterId && listed.has(chapter.chapterId));
}

async function SubjectBody({ params }: Props) {
  const [{ subject: key }, mindMaps] = await Promise.all([params, listGoalMindMaps()]);
  const { result, subject } = await findSubject(decodeURIComponent(key));

  if (result.status === "noGoal" || result.status === "unauthorized") {
    return (
      <>
        <JourneyPageBar />
        <LearnNoGoal />
      </>
    );
  }

  if (result.status !== "ready" || !subject) {
    notFound();
  }

  return (
    <SubjectScreenClient
      goalId={result.syllabus.goal.id}
      hasMindMaps={hasSubjectMindMaps({ mindMaps, subject })}
      subject={subject}
      syllabus={{
        fromMaterial: result.syllabus.fromMaterial,
        kind: result.syllabus.kind,
        writtenPractice: result.syllabus.writtenPractice,
      }}
    />
  );
}

function SubjectSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <JourneyPageBar />
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-2xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-1.5 w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    </div>
  );
}

/**
 * A subject of the active goal (an exam's notice subject or a module of the plan): its topics in
 * the notice's own words with progress and when the plan studies each, and its chapters. A key the
 * goal doesn't have isn't found.
 */
export default function SubjectPage(props: Props) {
  return (
    <Suspense fallback={<SubjectSkeleton />}>
      <SubjectBody {...props} />
    </Suspense>
  );
}
