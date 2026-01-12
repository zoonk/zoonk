import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import type { Route } from "next";
import { headers } from "next/headers";
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
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!chapter) {
    return notFound();
  }

  const canDelete = await hasCoursePermission({
    headers: await headers(),
    orgId: chapter.organizationId,
    permission: chapter.isPublished ? "delete" : "update",
  });

  const courseUrl = `/${orgSlug}/c/${lang}/${courseSlug}` as Route;
  const chapterUrl = `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}`;

  return (
    <ChapterActionsContainer>
      <PublishToggle
        isPublished={chapter.isPublished}
        onToggle={togglePublishAction.bind(null, {
          chapterId: chapter.id,
          chapterSlug,
          chapterUrl,
          courseSlug,
        })}
      />

      {canDelete && (
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
      )}
    </ChapterActionsContainer>
  );
}
