import { ErrorView } from "@zoonk/ui/patterns/error";
import { SUPPORT_URL } from "@zoonk/utils/constants";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Fragment } from "react";
import {
  EditorListAddButton,
  EditorListContent,
  EditorListHeader,
  EditorListInsertLine,
  EditorListItem,
  EditorListItemContent,
  EditorListItemDescription,
  EditorListItemPosition,
  EditorListItemTitle,
  EditorListProvider,
  EditorListSpinner,
} from "@/components/editor-list";
import { EntityListActions } from "@/components/entity-list-actions";
import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import {
  createLessonAction,
  exportLessonsAction,
  importLessonsAction,
} from "./actions";

type ChapterPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">;

export async function LessonList({
  params,
}: {
  params: ChapterPageProps["params"];
}) {
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

  const lastLesson = lessons.at(-1);
  const endPosition = lastLesson ? lastLesson.position + 1 : 0;

  return (
    <EditorListProvider onInsert={handleInsert}>
      <EditorListSpinner />

      <EditorListHeader>
        <EditorListAddButton position={endPosition}>
          {t("Add lesson")}
        </EditorListAddButton>

        <EntityListActions
          entityType="lessons"
          onExport={handleExport}
          onImport={handleImport}
        />
      </EditorListHeader>

      {lessons.length > 0 && (
        <EditorListContent>
          <EditorListInsertLine position={0} />

          {lessons.map((lesson) => (
            <Fragment key={lesson.slug}>
              <EditorListItem>
                <Link
                  className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                  href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lesson.slug}`}
                >
                  <EditorListItemPosition>
                    {lesson.position}
                  </EditorListItemPosition>

                  <EditorListItemContent>
                    <EditorListItemTitle>{lesson.title}</EditorListItemTitle>

                    {lesson.description && (
                      <EditorListItemDescription>
                        {lesson.description}
                      </EditorListItemDescription>
                    )}
                  </EditorListItemContent>
                </Link>
              </EditorListItem>

              <EditorListInsertLine position={lesson.position + 1} />
            </Fragment>
          ))}
        </EditorListContent>
      )}
    </EditorListProvider>
  );
}
