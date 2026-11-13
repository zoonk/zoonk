import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { AdminRecordTabs, readAdminTab } from "@/components/admin-tabs";
import { ReviewFlagNotice } from "@/components/review-flag-notice";
import { getLibraryLesson } from "@/data/lessons/get-library-lesson";
import { formatCount, formatDate, toWords } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { libraryLessonStatusLabels } from "@/lib/library-lesson-filters";
import { readQueryParam } from "@/lib/query-param";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonLanguageResources } from "./lesson-language-resources";
import { LessonScreens } from "./lesson-screens";
import { LessonAbout, LessonDetails, LessonOutline } from "./lesson-summary";
import { LessonVersions } from "./lesson-versions";

export async function generateMetadata({ params }: PageProps<"/lessons/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getLibraryLesson(id);

  if (!record) {
    notFound();
  }

  return { title: record.lesson.title };
}

const LESSON_PARENTS = [{ href: "/lessons", label: "Lessons" }];

const LESSON_TABS = [
  { label: "Screens", value: "screens" },
  { label: "Details", value: "details" },
  { label: "Written by", value: "written" },
] as const;

export default function LibraryLessonPage({ params, searchParams }: PageProps<"/lessons/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<LessonSkeleton />}>
        <LessonContent params={params} searchParams={searchParams} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function LessonContent({ params, searchParams }: PageProps<"/lessons/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (!isUuid(id)) {
    notFound();
  }

  const detail = await getLibraryLesson(id);

  if (!detail) {
    notFound();
  }

  const { lesson } = detail;
  const tab = readAdminTab({ tabs: LESSON_TABS, value: query.tab });

  return (
    <>
      <AdminDetailHeader
        alert={
          lesson.contentStatus === "completed"
            ? null
            : libraryLessonStatusLabels[lesson.contentStatus]
        }
        facts={[
          lesson.targetLanguage
            ? `${languageName(lesson.targetLanguage)}, taught in ${languageName(lesson.language)}`
            : languageName(lesson.language),
          toWords(lesson.level),
          `${lesson.estimatedMinutes} min`,
          formatCount(lesson.steps.length, "screen"),
          `Updated ${formatDate(lesson.updatedAt)}`,
        ]}
        parents={LESSON_PARENTS}
        title={lesson.title}
      />

      <AdminDetailBody>
        <ReviewFlagNotice target={{ lessonId: lesson.id }} />
        <AdminRecordTabs
          current={tab}
          label="Lesson"
          path={`/lessons/${lesson.id}`}
          tabs={LESSON_TABS}
        />

        {tab === "screens" ? (
          <AdminDetailColumns aside={<LessonAbout lesson={lesson} />}>
            <LessonScreens
              answers={detail.answers}
              json={readQueryParam(query.json) === "1"}
              lessonId={lesson.id}
              steps={lesson.steps}
            />
          </AdminDetailColumns>
        ) : null}

        {tab === "details" ? (
          <>
            <LessonDetails lesson={lesson} />
            <LessonLanguageResources sentences={lesson.sentences} words={lesson.words} />
          </>
        ) : null}

        {tab === "written" ? (
          <>
            <LessonOutline lesson={lesson} />
            <LessonVersions steps={lesson.steps} />
          </>
        ) : null}
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
