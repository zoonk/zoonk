import type { Route } from "next";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getChapter } from "@/data/chapters/get-chapter";
import { deleteChapterAction, togglePublishAction } from "./actions";
import { ChapterActionsContainer } from "./chapter-actions-container";

type ChapterNavbarActionsPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">;

export async function ChapterActions({
  params,
}: {
  params: ChapterNavbarActionsPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const { data: chapter } = await getChapter({
    chapterSlug,
    language: lang,
    orgSlug,
  });

  if (!chapter) {
    return notFound();
  }

  const courseUrl = `/${orgSlug}/c/${lang}/${courseSlug}` as Route;

  return (
    <ChapterActionsContainer>
      <PublishToggle
        isPublished={chapter.isPublished}
        onToggle={togglePublishAction.bind(
          null,
          chapterSlug,
          courseSlug,
          chapter.id,
        )}
      />

      <DeleteItemButton
        onDelete={deleteChapterAction.bind(
          null,
          chapterSlug,
          courseSlug,
          chapter.id,
          courseUrl,
        )}
        srLabel={t("Delete chapter")}
        title={t("Delete chapter?")}
      />
    </ChapterActionsContainer>
  );
}
