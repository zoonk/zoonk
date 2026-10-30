import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { ReviewFlagNotice } from "@/components/review-flag-notice";
import { getLibraryLesson } from "@/data/lessons/get-library-lesson";
import { capitalize } from "@/lib/format";
import { libraryLessonStatusLabels } from "@/lib/library-lesson-filters";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonLanguageResources } from "./lesson-language-resources";
import { LessonScreens } from "./lesson-screens";
import { LessonOutline, LessonSummary } from "./lesson-summary";
import { LessonVersions } from "./lesson-versions";

export const metadata: Metadata = { title: "Lesson" };

const LESSON_PARENTS = [{ href: "/lessons", label: "Lessons" }];

export default function LibraryLessonPage({ params }: PageProps<"/lessons/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<LessonSkeleton />}>
        <LessonContent params={params} />
      </Suspense>
    </AdminDetailPage>
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
      <AdminDetailHeader
        facts={[
          libraryLessonStatusLabels[lesson.contentStatus],
          lesson.targetLanguage
            ? `${lesson.language.toUpperCase()} → ${lesson.targetLanguage.toUpperCase()}`
            : lesson.language.toUpperCase(),
          capitalize(lesson.level),
          `${lesson.estimatedMinutes} min`,
        ]}
        parents={LESSON_PARENTS}
        title={lesson.title}
      />

      <AdminDetailBody>
        <ReviewFlagNotice target={{ lessonId: lesson.id }} />
        <LessonSummary lesson={lesson} />
        <LessonOutline lesson={lesson} />
        <LessonVersions steps={lesson.steps} />
        <LessonScreens answers={detail.answers} steps={lesson.steps} />
        <LessonLanguageResources sentences={lesson.sentences} words={lesson.words} />
      </AdminDetailBody>
    </>
  );
}

function LessonSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={LESSON_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton rows={10} />
        <AdminSectionSkeleton />
      </AdminDetailBody>
    </>
  );
}
