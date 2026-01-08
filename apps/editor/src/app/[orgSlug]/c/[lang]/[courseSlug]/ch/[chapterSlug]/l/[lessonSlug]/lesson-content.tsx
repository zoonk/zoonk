import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { ContentEditor } from "@/components/content-editor";
import { getLesson } from "@/data/lessons/get-lesson";
import {
  updateLessonDescriptionAction,
  updateLessonTitleAction,
} from "./actions";

type LessonPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

export async function LessonContent({
  params,
}: {
  params: LessonPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, lessonSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lesson, error } = await getLesson({
    language: lang,
    lessonSlug,
    orgSlug,
  });

  if (error || !lesson) {
    return notFound();
  }

  const slugs = { chapterSlug, courseSlug, lang, lessonSlug, orgSlug };

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
