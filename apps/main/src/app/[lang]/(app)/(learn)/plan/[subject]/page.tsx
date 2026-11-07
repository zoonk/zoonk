import { NotFoundPage } from "@/components/errors/not-found-page";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { getTutorViewer } from "@/lib/learn/tutor-viewer";
import { hasGoalMindMaps } from "@zoonk/core/mind-maps/has-any";
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

async function SubjectBody({ params }: Props) {
  const [{ subject: key }, tutor] = await Promise.all([params, getTutorViewer()]);
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

  const hasMindMaps = await hasGoalMindMaps({
    chapterIds: subject.chapters.flatMap((chapter) => chapter.chapterId ?? []),
  });

  return (
    <SubjectScreenClient
      goalId={result.syllabus.goal.id}
      hasMindMaps={hasMindMaps}
      subject={subject}
      syllabus={{
        examDocument: result.syllabus.examDocument,
        fromMaterial: result.syllabus.fromMaterial,
        kind: result.syllabus.kind,
        knownTopicsReturn: result.syllabus.knownTopicsReturn,
        questionsSource: result.syllabus.questionsSource,
        sharedExams: result.syllabus.sharedExams,
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
