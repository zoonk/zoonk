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
  EditorListItemPosition,
  EditorListItemTitle,
  EditorListProvider,
  EditorListSpinner,
  EditorSortableItem,
  EditorSortableItemRow,
  EditorSortableList,
} from "@/components/editor-list";
import { EntityListActions } from "@/components/entity-list-actions";
import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import {
  exportLessonsAction,
  handleImportLessonsAction,
  insertLessonAction,
  reorderLessonsAction,
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

  const routeParams = { chapterId, chapterSlug, courseSlug, lang, orgSlug };

  const lastLesson = lessons.at(-1);
  const endPosition = lastLesson ? lastLesson.position + 1 : 0;

  return (
    <EditorListProvider onInsert={insertLessonAction.bind(null, routeParams)}>
      <EditorListSpinner />

      <EditorListHeader>
        <EditorListAddButton position={endPosition}>
          {t("Add lesson")}
        </EditorListAddButton>

        <EntityListActions
          entityType="lessons"
          onExport={exportLessonsAction.bind(null, chapterId)}
          onImport={handleImportLessonsAction.bind(null, routeParams)}
        />
      </EditorListHeader>

      {lessons.length > 0 && (
        <EditorSortableList
          items={lessons}
          onReorder={reorderLessonsAction.bind(null, routeParams)}
        >
          <EditorListContent>
            {lessons.map((lesson, index) => (
              <EditorSortableItem id={lesson.id} key={lesson.slug}>
                <EditorListItem>
                  <EditorSortableItemRow>
                    <EditorDragHandle aria-label={t("Drag to reorder")} />

                    <EditorListItemLink
                      render={
                        <Link
                          href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lesson.slug}`}
                        />
                      }
                    >
                      <EditorListItemPosition>
                        {index + 1}
                      </EditorListItemPosition>

                      <EditorListItemContent>
                        <EditorListItemTitle>
                          {lesson.title}
                        </EditorListItemTitle>

                        {lesson.description && (
                          <EditorListItemDescription>
                            {lesson.description}
                          </EditorListItemDescription>
                        )}
                      </EditorListItemContent>
                    </EditorListItemLink>

                    <EditorListItemActions
                      aria-label={t("Lesson actions")}
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
