import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { ReviewFlagNotice } from "@/components/review-flag-notice";
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
 * who wrote each, and how learners answered.
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

  return (
    <>
      <ReviewFlagNotice target={{ lessonId: lesson.id }} />
      <LessonSummary lesson={lesson} />
      <LessonVersions steps={lesson.steps} />
      <LessonScreens answers={detail.answers} steps={lesson.steps} />
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
