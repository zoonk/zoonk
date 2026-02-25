import {
  EditorListAddButton,
  EditorListContent,
  EditorListHeader,
  EditorListProvider,
  EditorListSpinner,
  EditorSortableList,
} from "@/components/editor-list";
import { EntityListActions } from "@/components/entity/entity-list-actions";
import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { ErrorView } from "@zoonk/ui/patterns/error";
import { SUPPORT_URL } from "@zoonk/utils/constants";
import { getExtracted } from "next-intl/server";
import {
  exportLessonsAction,
  handleImportLessonsAction,
  insertLessonAction,
  reorderLessonsAction,
} from "./actions";
import { LessonListRow } from "./lesson-list-row";

export async function LessonList({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]">["params"];
}) {
  const { chapterSlug, courseSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: chapter } = await getChapter({
    chapterSlug,
    courseSlug,
    orgSlug,
  });

  if (!chapter) {
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

  const { data: lessons, error } = await listChapterLessons({
    chapterId,
    orgId: chapter.organizationId,
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

  const routeParams = { chapterId, chapterSlug, courseSlug, orgSlug };

  const lastLesson = lessons.at(-1);
  const endPosition = lastLesson ? lastLesson.position + 1 : 0;

  return (
    <EditorListProvider onInsert={insertLessonAction.bind(null, routeParams)}>
      <EditorListSpinner />

      <EditorListHeader>
        <EditorListAddButton position={endPosition}>{t("Add lesson")}</EditorListAddButton>

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
              <LessonListRow
                chapterSlug={chapterSlug}
                courseSlug={courseSlug}
                index={index}
                key={lesson.slug}
                lesson={lesson}
                orgSlug={orgSlug}
              />
            ))}
          </EditorListContent>
        </EditorSortableList>
      )}
    </EditorListProvider>
  );
}
