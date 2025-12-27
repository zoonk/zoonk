import { Container } from "@zoonk/ui/components/container";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ContentEditor } from "@/app/[orgSlug]/_components/content-editor";
import { ContentEditorSkeleton } from "@/app/[orgSlug]/_components/content-editor-skeleton";
import { ItemList } from "@/app/[orgSlug]/_components/item-list";
import { ItemListSkeleton } from "@/app/[orgSlug]/_components/item-list-skeleton";
import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import {
  updateChapterDescriptionAction,
  updateChapterTitleAction,
} from "./actions";

async function ChapterContent({
  params,
}: {
  params: PageProps<"/[orgSlug]/ch/[chapterSlug]">["params"];
}) {
  const { chapterSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: chapter, error } = await getChapter({
    chapterSlug,
    orgSlug,
  });

  if (error || !chapter) {
    return notFound();
  }

  return (
    <ContentEditor
      descriptionLabel={t("Edit chapter description")}
      descriptionPlaceholder={t("Chapter description…")}
      entityId={chapter.id}
      initialDescription={chapter.description}
      initialTitle={chapter.title}
      onSaveDescription={updateChapterDescriptionAction}
      onSaveTitle={updateChapterTitleAction}
      titleLabel={t("Edit chapter title")}
      titlePlaceholder={t("Chapter title…")}
    />
  );
}

async function LessonList({
  params,
}: {
  params: PageProps<"/[orgSlug]/ch/[chapterSlug]">["params"];
}) {
  const { chapterSlug, orgSlug } = await params;

  const { data: lessons } = await listChapterLessons({
    chapterSlug,
    orgSlug,
  });

  return (
    <ItemList
      getHref={(item) => `/${orgSlug}/l/${item.slug}`}
      items={lessons}
    />
  );
}

export default async function ChapterPage(
  props: PageProps<"/[orgSlug]/ch/[chapterSlug]">,
) {
  return (
    <Container variant="narrow">
      <Suspense fallback={<ContentEditorSkeleton />}>
        <ChapterContent params={props.params} />
      </Suspense>

      <Suspense fallback={<ItemListSkeleton />}>
        <LessonList params={props.params} />
      </Suspense>
    </Container>
  );
}
