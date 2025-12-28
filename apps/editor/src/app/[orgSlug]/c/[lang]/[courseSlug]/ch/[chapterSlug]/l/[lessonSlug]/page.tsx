import { Container } from "@zoonk/ui/components/container";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ContentEditor } from "@/app/[orgSlug]/_components/content-editor";
import { ContentEditorSkeleton } from "@/app/[orgSlug]/_components/content-editor-skeleton";
import { getLesson } from "@/data/lessons/get-lesson";
import {
  updateLessonDescriptionAction,
  updateLessonTitleAction,
} from "./actions";

type LessonPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

async function LessonContent({
  params,
}: {
  params: LessonPageProps["params"];
}) {
  const { lessonSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lesson, error } = await getLesson({
    lessonSlug,
    orgSlug,
  });

  if (error || !lesson) {
    return notFound();
  }

  return (
    <ContentEditor
      descriptionLabel={t("Edit lesson description")}
      descriptionPlaceholder={t("Lesson description…")}
      entityId={lesson.id}
      initialDescription={lesson.description}
      initialTitle={lesson.title}
      onSaveDescription={updateLessonDescriptionAction}
      onSaveTitle={updateLessonTitleAction}
      titleLabel={t("Edit lesson title")}
      titlePlaceholder={t("Lesson title…")}
    />
  );
}

export default async function LessonPage(props: LessonPageProps) {
  return (
    <Container variant="narrow">
      <Suspense fallback={<ContentEditorSkeleton />}>
        <LessonContent params={props.params} />
      </Suspense>
    </Container>
  );
}
