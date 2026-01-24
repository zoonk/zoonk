import { ContentEditor } from "@/components/content-editor";
import { getChapter } from "@/data/chapters/get-chapter";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { updateChapterDescriptionAction, updateChapterTitleAction } from "./actions";

export async function ChapterContent({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">["params"];
}) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const { data: chapter, error } = await getChapter({
    chapterSlug,
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (error || !chapter) {
    return notFound();
  }

  const slugs = { chapterSlug, courseSlug, lang, orgSlug };

  return (
    <ContentEditor
      descriptionLabel={t("Edit chapter description")}
      descriptionPlaceholder={t("Chapter description…")}
      entityId={chapter.id}
      initialDescription={chapter.description}
      initialTitle={chapter.title}
      onSaveDescription={updateChapterDescriptionAction.bind(null, slugs)}
      onSaveTitle={updateChapterTitleAction.bind(null, slugs)}
      titleLabel={t("Edit chapter title")}
      titlePlaceholder={t("Chapter title…")}
    />
  );
}
