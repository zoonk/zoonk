import type { Route } from "next";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getChapter } from "@/data/chapters/get-chapter";
import { deleteChapterAction, togglePublishAction } from "./actions";

type ChapterNavbarActionsPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">;

function ChapterActionsContainer({ children }: React.PropsWithChildren) {
  return <div className="flex items-center gap-2">{children}</div>;
}

function ChapterActionsSkeleton() {
  return (
    <ChapterActionsContainer>
      <PublishToggle isPublished={false} />
      <DeleteItemButton />
    </ChapterActionsContainer>
  );
}

async function ChapterActions({
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

export default async function ChapterNavbarActions(
  props: ChapterNavbarActionsPageProps,
) {
  return (
    <Suspense fallback={<ChapterActionsSkeleton />}>
      <ChapterActions params={props.params} />
    </Suspense>
  );
}
