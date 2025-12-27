import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getChapter } from "@/data/chapters/get-chapter";
import { deleteChapterAction, togglePublishAction } from "./actions";

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
}: PageProps<"/[orgSlug]/ch/[chapterSlug]">) {
  const { chapterSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: chapter } = await getChapter({
    chapterSlug,
    orgSlug,
  });

  if (!chapter) {
    return notFound();
  }

  return (
    <ChapterActionsContainer>
      <PublishToggle
        isPublished={chapter.isPublished}
        onToggle={togglePublishAction.bind(null, chapter.id)}
      />

      <DeleteItemButton
        onDelete={deleteChapterAction.bind(null, chapter.id, orgSlug)}
        srLabel={t("Delete chapter")}
        title={t("Delete chapter?")}
      />
    </ChapterActionsContainer>
  );
}

export default async function ChapterNavbarActions(
  props: PageProps<"/[orgSlug]/ch/[chapterSlug]">,
) {
  return (
    <Suspense fallback={<ChapterActionsSkeleton />}>
      <ChapterActions {...props} />
    </Suspense>
  );
}
