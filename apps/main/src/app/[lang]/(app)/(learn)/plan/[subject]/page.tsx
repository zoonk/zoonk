import { NotFoundPage } from "@/components/errors/not-found-page";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNoGoal } from "../../_components/learn-no-goal";
import { LearnNotFound } from "../../_components/learn-not-found";
import { SubjectScreenClient } from "./subject-screen-client";

type Props = PageProps<"/[lang]/plan/[subject]">;

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
  const t = await getExtracted();
  const { subject: key } = await params;
  const { subject } = await findSubject(decodeURIComponent(key));

  return { title: subject?.shortName ?? t("Plan") };
}

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
  const [{ subject: key }, mindMaps, tutor] = await Promise.all([
    params,
    listGoalMindMaps(),
    getTutorViewer(),
  ]);

  const { result, subject } = await findSubject(decodeURIComponent(key));

  if (result.status === "noGoal" || result.status === "unauthorized") {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={<JourneyPageBar />}
        description={t("What you'll study each day until your goal, and what it covers.")}
        next={`/plan/${key}`}
        title={t("Plan")}
      />
    );
  }

  if (result.status !== "ready" || !subject) {
    return (
      <NotFoundPage>
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  return (
    <SubjectScreenClient
      goalId={result.syllabus.goal.id}
      hasMindMaps={hasSubjectMindMaps({ mindMaps, subject })}
      subject={subject}
      syllabus={{
        examDocument: result.syllabus.examDocument,
        fromMaterial: result.syllabus.fromMaterial,
        kind: result.syllabus.kind,
        knownTopicsReturn: result.syllabus.knownTopicsReturn,
        questionsSource: result.syllabus.questionsSource,
        writtenPractice: result.syllabus.writtenPractice,
      }}
      tutor={tutor}
    />
  );
}

export default function SubjectPage(props: Props) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <SubjectBody {...props} />
    </Suspense>
  );
}
