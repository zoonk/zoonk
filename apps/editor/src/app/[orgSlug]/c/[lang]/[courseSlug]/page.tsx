import { Container } from "@zoonk/ui/components/container";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ContentEditor } from "@/app/[orgSlug]/_components/content-editor";
import { ContentEditorSkeleton } from "@/app/[orgSlug]/_components/content-editor-skeleton";
import { ItemList } from "@/app/[orgSlug]/_components/item-list";
import { ItemListSkeleton } from "@/app/[orgSlug]/_components/item-list-skeleton";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import {
  updateCourseDescriptionAction,
  updateCourseTitleAction,
} from "./actions";

async function CourseContent({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const { data: course, error } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (error || !course) {
    return notFound();
  }

  return (
    <ContentEditor
      descriptionLabel={t("Edit course description")}
      descriptionPlaceholder={t("Course description…")}
      entityId={course.id}
      initialDescription={course.description}
      initialTitle={course.title}
      onSaveDescription={updateCourseDescriptionAction}
      onSaveTitle={updateCourseTitleAction}
      titleLabel={t("Edit course title")}
      titlePlaceholder={t("Course title…")}
    />
  );
}

async function ChapterList({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;

  const { data: chapters } = await listCourseChapters({
    courseSlug,
    language: lang,
    orgSlug,
  });

  return (
    <ItemList
      getHref={(item) => `/${orgSlug}/ch/${item.slug}`}
      items={chapters}
    />
  );
}

export default async function CoursePage(
  props: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">,
) {
  return (
    <Container variant="narrow">
      <Suspense fallback={<ContentEditorSkeleton />}>
        <CourseContent params={props.params} />
      </Suspense>

      <Suspense fallback={<ItemListSkeleton />}>
        <ChapterList params={props.params} />
      </Suspense>
    </Container>
  );
}
