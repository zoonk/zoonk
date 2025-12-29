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
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import {
  createChapterAction,
  exportChaptersAction,
  importChaptersAction,
} from "./actions";

export async function ChapterList({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const [{ data: chapters, error }, { data: course }] = await Promise.all([
    listCourseChapters({ courseSlug, language: lang, orgSlug }),
    getCourse({ courseSlug, language: lang, orgSlug }),
  ]);

  if (error || !course) {
    return (
      <ErrorView
        description={t("We couldn't load the chapters. Please try again.")}
        retryLabel={t("Try again")}
        supportHref={SUPPORT_URL}
        supportLabel={t("Contact support")}
        title={t("Failed to load chapters")}
      />
    );
  }

  const courseId = course.id;

  async function handleInsert(position: number) {
    "use server";
    const { slug, error: createError } = await createChapterAction(
      courseSlug,
      courseId,
      position,
    );

    if (createError) {
      throw new Error(createError);
    }

    if (slug) {
      revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
      redirect(`/${orgSlug}/c/${lang}/${courseSlug}/ch/${slug}`);
    }
  }

  async function handleImport(
    formData: FormData,
  ): Promise<{ error: string | null }> {
    "use server";
    const { error: importError } = await importChaptersAction(
      courseSlug,
      courseId,
      formData,
    );

    if (importError) {
      return { error: importError };
    }

    revalidatePath(`/${orgSlug}/c/${lang}/${courseSlug}`);
    return { error: null };
  }

  async function handleExport(): Promise<{
    data: object | null;
    error: Error | null;
  }> {
    "use server";
    const { data: exportData, error: exportError } =
      await exportChaptersAction(courseId);

    if (exportError) {
      return { data: null, error: exportError };
    }

    return { data: exportData, error: null };
  }

  const lastChapter = chapters.at(-1);
  const endPosition = lastChapter ? lastChapter.position + 1 : 0;

  return (
    <EditorListProvider onInsert={handleInsert}>
      <EditorListSpinner />

      <EditorListHeader>
        <EditorListAddButton position={endPosition}>
          {t("Add chapter")}
        </EditorListAddButton>

        <EntityListActions
          entityType="chapters"
          onExport={handleExport}
          onImport={handleImport}
        />
      </EditorListHeader>

      {chapters.length > 0 && (
        <EditorListContent>
          <EditorListInsertLine position={0} />

          {chapters.map((chapter) => (
            <Fragment key={chapter.slug}>
              <EditorListItem>
                <Link
                  className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                  href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapter.slug}`}
                >
                  <EditorListItemPosition>
                    {chapter.position}
                  </EditorListItemPosition>

                  <EditorListItemContent>
                    <EditorListItemTitle>{chapter.title}</EditorListItemTitle>

                    {chapter.description && (
                      <EditorListItemDescription>
                        {chapter.description}
                      </EditorListItemDescription>
                    )}
                  </EditorListItemContent>
                </Link>
              </EditorListItem>

              <EditorListInsertLine position={chapter.position + 1} />
            </Fragment>
          ))}
        </EditorListContent>
      )}
    </EditorListProvider>
  );
}
