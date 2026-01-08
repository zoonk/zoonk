import { ErrorView } from "@zoonk/ui/patterns/error";
import { SUPPORT_URL } from "@zoonk/utils/constants";
import Link from "next/link";
import { getExtracted } from "next-intl/server";
import {
  EditorDragHandle,
  EditorListAddButton,
  EditorListContent,
  EditorListHeader,
  EditorListItem,
  EditorListItemActions,
  EditorListItemContent,
  EditorListItemDescription,
  EditorListItemLink,
  EditorListItemTitle,
  EditorListProvider,
  EditorListSpinner,
  EditorSortableItem,
  EditorSortableItemRow,
  EditorSortableList,
} from "@/components/editor-list";
import { EntityListActions } from "@/components/entity-list-actions";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import {
  exportChaptersAction,
  handleImportChaptersAction,
  insertChapterAction,
  reorderChaptersAction,
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

  const routeParams = { courseId, courseSlug, lang, orgSlug };

  const lastChapter = chapters.at(-1);
  const endPosition = lastChapter ? lastChapter.position + 1 : 0;

  return (
    <EditorListProvider onInsert={insertChapterAction.bind(null, routeParams)}>
      <EditorListSpinner />

      <EditorListHeader>
        <EditorListAddButton position={endPosition}>
          {t("Add chapter")}
        </EditorListAddButton>

        <EntityListActions
          entityType="chapters"
          onExport={exportChaptersAction.bind(null, courseId)}
          onImport={handleImportChaptersAction.bind(null, routeParams)}
        />
      </EditorListHeader>

      {chapters.length > 0 && (
        <EditorSortableList
          items={chapters}
          onReorder={reorderChaptersAction.bind(null, routeParams)}
        >
          <EditorListContent>
            {chapters.map((chapter, index) => (
              <EditorSortableItem id={chapter.id} key={chapter.slug}>
                <EditorListItem>
                  <EditorSortableItemRow>
                    <EditorDragHandle aria-label={t("Drag to reorder")}>
                      {index + 1}
                    </EditorDragHandle>

                    <EditorListItemLink
                      render={
                        <Link
                          href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapter.slug}`}
                        />
                      }
                    >
                      <EditorListItemContent>
                        <EditorListItemTitle>
                          {chapter.title}
                        </EditorListItemTitle>

                        {chapter.description && (
                          <EditorListItemDescription>
                            {chapter.description}
                          </EditorListItemDescription>
                        )}
                      </EditorListItemContent>
                    </EditorListItemLink>

                    <EditorListItemActions
                      aria-label={t("Chapter actions")}
                      insertAboveLabel={t("Insert above")}
                      insertBelowLabel={t("Insert below")}
                      position={index}
                    />
                  </EditorSortableItemRow>
                </EditorListItem>
              </EditorSortableItem>
            ))}
          </EditorListContent>
        </EditorSortableList>
      )}
    </EditorListProvider>
  );
}
