import { Container } from "@zoonk/ui/components/container";
import { ErrorView } from "@zoonk/ui/patterns/error";
import { SUPPORT_URL } from "@zoonk/utils/constants";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import {
  BackLink,
  BackLinkSkeleton,
} from "@/app/[orgSlug]/_components/back-link";
import { ContentEditor } from "@/app/[orgSlug]/_components/content-editor";
import { ContentEditorSkeleton } from "@/app/[orgSlug]/_components/content-editor-skeleton";
import { ItemListEditable } from "@/app/[orgSlug]/_components/item-list-editable";
import { ItemListSkeleton } from "@/app/[orgSlug]/_components/item-list-skeleton";
import { SlugEditor } from "@/app/[orgSlug]/_components/slug-editor";
import { SlugEditorSkeleton } from "@/app/[orgSlug]/_components/slug-editor-skeleton";
import { getChapter } from "@/data/chapters/get-chapter";
import { getCourse } from "@/data/courses/get-course";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import {
  checkChapterSlugExists,
  createLessonAction,
  exportLessonsAction,
  importLessonsAction,
  updateChapterDescriptionAction,
  updateChapterSlugAction,
  updateChapterTitleAction,
} from "./actions";

type ChapterPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">;

async function ChapterBackLink({
  params,
}: {
  params: ChapterPageProps["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;
  const { data: course } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!course) {
    return null;
  }

  return (
    <BackLink href={`/${orgSlug}/c/${lang}/${courseSlug}`}>
      {course.title}
    </BackLink>
  );
}

async function ChapterContent({
  params,
}: {
  params: ChapterPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const { data: chapter, error } = await getChapter({
    chapterSlug,
    language: lang,
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
      onSaveDescription={updateChapterDescriptionAction.bind(
        null,
        chapterSlug,
        courseSlug,
      )}
      onSaveTitle={updateChapterTitleAction.bind(null, chapterSlug, courseSlug)}
      titleLabel={t("Edit chapter title")}
      titlePlaceholder={t("Chapter title…")}
    />
  );
}

async function LessonList({ params }: { params: ChapterPageProps["params"] }) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const [{ data: lessons, error }, { data: chapter }] = await Promise.all([
    listChapterLessons({ chapterSlug, orgSlug }),
    getChapter({ chapterSlug, language: lang, orgSlug }),
  ]);

  if (error || !chapter) {
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

  const chapterId = chapter.id;

  async function handleInsert(position: number) {
    "use server";
    const { slug, error: createError } = await createLessonAction(
      chapterSlug,
      courseSlug,
      chapterId,
      position,
    );

    if (createError) {
      throw new Error(createError);
    }

    if (slug) {
      revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}`);
      redirect(
        `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${slug}`,
      );
    }
  }

  async function handleImport(
    formData: FormData,
  ): Promise<{ error: string | null }> {
    "use server";
    const { error: importError } = await importLessonsAction(
      chapterSlug,
      courseSlug,
      chapterId,
      formData,
    );

    if (importError) {
      return { error: importError };
    }

    revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}`);
    return { error: null };
  }

  async function handleExport(): Promise<{
    data: object | null;
    error: Error | null;
  }> {
    "use server";
    const { data: exportData, error: exportError } =
      await exportLessonsAction(chapterId);

    if (exportError) {
      return { data: null, error: exportError };
    }

    return { data: exportData, error: null };
  }

  return (
    <ItemListEditable
      addLabel={t("Add lesson")}
      cancelLabel={t("Cancel")}
      dropLabel={t("Drop file or click to select")}
      entityType="lessons"
      exportErrorMessage={t("Failed to export")}
      exportLabel={t("Export")}
      exportSuccessMessage={t("Lessons exported successfully")}
      fileSizeUnit={t("KB")}
      hrefPrefix={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/`}
      importDescription={t("Upload a JSON file containing lessons to import.")}
      importLabel={t("Import")}
      importSuccessMessage={t("Lessons imported successfully")}
      importTitle={t("Import lessons")}
      items={lessons}
      modeLabel={t("Import mode")}
      modeMergeLabel={t("Merge (add to existing)")}
      modeReplaceLabel={t("Replace (remove existing first)")}
      moreOptionsLabel={t("More options")}
      onExport={handleExport}
      onImport={handleImport}
      onInsert={handleInsert}
      showFormatLabel={t("Show expected format")}
    />
  );
}

async function ChapterSlug({ params }: { params: ChapterPageProps["params"] }) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await params;

  const { data: chapter } = await getChapter({
    chapterSlug,
    language: lang,
    orgSlug,
  });

  if (!chapter) {
    return null;
  }

  return (
    <SlugEditor
      checkFn={checkChapterSlugExists}
      entityId={chapter.id}
      initialSlug={chapter.slug}
      language={lang}
      onSave={updateChapterSlugAction.bind(null, chapterSlug, courseSlug)}
      orgSlug={orgSlug}
      redirectPrefix={`/${orgSlug}/c/${lang}/${courseSlug}/ch/`}
    />
  );
}

export default async function ChapterPage(props: ChapterPageProps) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await props.params;

  // Preload data in parallel (cached, so child components get the same promise)
  void Promise.all([
    getCourse({ courseSlug, language: lang, orgSlug }),
    getChapter({ chapterSlug, language: lang, orgSlug }),
    listChapterLessons({ chapterSlug, orgSlug }),
  ]);

  return (
    <Container variant="narrow">
      <Suspense fallback={<BackLinkSkeleton />}>
        <ChapterBackLink params={props.params} />
      </Suspense>

      <Suspense fallback={<ContentEditorSkeleton />}>
        <ChapterContent params={props.params} />
      </Suspense>

      <Suspense fallback={<SlugEditorSkeleton />}>
        <ChapterSlug params={props.params} />
      </Suspense>

      <Suspense fallback={<ItemListSkeleton />}>
        <LessonList params={props.params} />
      </Suspense>
    </Container>
  );
}
