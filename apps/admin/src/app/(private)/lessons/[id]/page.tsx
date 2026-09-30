import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { ReviewFlagNotice } from "@/components/review-flag-notice";
import { getVoteTotals } from "@/data/feedback/get-vote-totals";
import { getDepthRequests } from "@/data/lessons/get-depth-requests";
import { getLibraryLesson } from "@/data/lessons/get-library-lesson";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonLanguageResources } from "./lesson-language-resources";
import { LessonScreens } from "./lesson-screens";
import { LessonSummary } from "./lesson-summary";
import { LessonVersions } from "./lesson-versions";

export const metadata: Metadata = { title: "Lesson" };

/**
 * One Library lesson as admins review it: where it lives, its screens with every version and
 * who wrote each, and how learners answered, voted and asked for Simpler or deeper versions.
 */
export default function LibraryLessonPage({ params }: PageProps<"/lessons/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb current="Lesson" parents={[{ href: "/lessons", label: "Lessons" }]} />
          <ContainerTitle>Lesson</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <Suspense fallback={<LessonSkeleton />}>
          <LessonContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function LessonContent({ params }: Pick<PageProps<"/lessons/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const detail = await getLibraryLesson(id);

  if (!detail) {
    notFound();
  }

  const { lesson } = detail;
  const stepIds = lesson.steps.map((step) => step.id);
  const variantIds = lesson.steps.flatMap((step) => step.variants.map((variant) => variant.id));

  const [lessonVotes, stepVotes, variantVotes, depthRequests] = await Promise.all([
    getVoteTotals({ contentIds: [lesson.id], contentKind: "lesson" }),
    getVoteTotals({ contentIds: stepIds, contentKind: "step" }),
    getVoteTotals({ contentIds: variantIds, contentKind: "stepVariant" }),
    getDepthRequests(stepIds),
  ]);

  return (
    <>
      <ReviewFlagNotice target={{ lessonId: lesson.id }} />
      <LessonSummary lesson={lesson} votes={lessonVotes} />
      <LessonVersions steps={lesson.steps} />
      <LessonScreens
        answers={detail.answers}
        depthRequests={depthRequests}
        steps={lesson.steps}
        stepVotes={stepVotes}
        variantVotes={variantVotes}
      />
      <LessonLanguageResources sentences={lesson.sentences} words={lesson.words} />
    </>
  );
}

function LessonSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
