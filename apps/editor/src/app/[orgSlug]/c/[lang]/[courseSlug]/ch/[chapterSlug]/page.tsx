import { Container } from "@zoonk/ui/components/container";
import { ErrorView } from "@zoonk/ui/patterns/error";
import { SUPPORT_URL } from "@zoonk/utils/constants";
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

type ChapterPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">;

async function ChapterContent({
  params,
}: {
  params: ChapterPageProps["params"];
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

async function LessonList({ params }: { params: ChapterPageProps["params"] }) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lessons, error } = await listChapterLessons({
    chapterSlug,
    orgSlug,
  });

  if (error) {
    return (
      <ErrorView
        description={t("We couldn't load the lessons. Please try again.")}
        retryLabel={t("Try again")}
        supportHref={SUPPORT_URL}
        supportLabel={t("Contact support")}
        title={t("Failed to load lessons")}
      />
    );
  }

  return (
    <ItemList
      getHref={(item) =>
        `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${item.slug}`
      }
      items={lessons}
    />
  );
}

export default async function ChapterPage(props: ChapterPageProps) {
  const { chapterSlug, orgSlug } = await props.params;

  // Preload data in parallel (cached, so child components get the same promise)
  void Promise.all([
    getChapter({ chapterSlug, orgSlug }),
    listChapterLessons({ chapterSlug, orgSlug }),
  ]);

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
