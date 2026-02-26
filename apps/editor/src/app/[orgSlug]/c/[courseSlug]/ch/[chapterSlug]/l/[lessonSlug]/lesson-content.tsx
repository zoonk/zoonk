import { ContentEditor } from "@/components/content-editor";
import { getLesson } from "@/data/lessons/get-lesson";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { updateLessonDescriptionAction, updateLessonTitleAction } from "./actions";

export async function LessonContent({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">["params"];
}) {
  const { chapterSlug, courseSlug, lessonSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lesson, error } = await getLesson({
    chapterSlug,
    courseSlug,
    lessonSlug,
    orgSlug,
  });

  if (error || !lesson) {
    return notFound();
  }

  const slugs = { chapterSlug, courseSlug, orgSlug };

  return (
    <ContentEditor
      descriptionLabel={t("Edit lesson description")}
      descriptionPlaceholder={t("Lesson description…")}
      entityId={lesson.id}
      initialDescription={lesson.description}
      initialTitle={lesson.title}
      onSaveDescription={updateLessonDescriptionAction.bind(null, slugs)}
      onSaveTitle={updateLessonTitleAction.bind(null, slugs)}
      titleLabel={t("Edit lesson title")}
      titlePlaceholder={t("Lesson title…")}
    />
  );
}
