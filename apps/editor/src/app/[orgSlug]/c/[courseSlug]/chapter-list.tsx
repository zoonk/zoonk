import {
  EditorListAddButton,
  EditorListContent,
  EditorListHeader,
  EditorListProvider,
  EditorListSpinner,
  EditorSortableList,
} from "@/components/editor-list";
import { EntityListActions } from "@/components/entity/entity-list-actions";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { ErrorView } from "@zoonk/ui/patterns/error";
import { SUPPORT_URL } from "@zoonk/utils/constants";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  exportChaptersAction,
  handleImportChaptersAction,
  insertChapterAction,
  reorderChaptersAction,
} from "./_actions/chapters";
import { ChapterListRow } from "./chapter-list-row";

export async function ChapterList({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]">["params"];
}) {
  const { courseSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: course } = await getCourse({ courseSlug, orgSlug });

  if (!course) {
    notFound();
  }

  const { data: chapters, error } = await listCourseChapters({
    courseId: course.id,
    orgId: course.organizationId,
  });

  if (error) {
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

  const routeParams = { courseId, courseSlug, orgSlug };

  const lastChapter = chapters.at(-1);
  const endPosition = lastChapter ? lastChapter.position + 1 : 0;

  return (
    <EditorListProvider onInsert={insertChapterAction.bind(null, routeParams)}>
      <EditorListSpinner />

      <EditorListHeader>
        <EditorListAddButton position={endPosition}>{t("Add chapter")}</EditorListAddButton>

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
              <ChapterListRow
                chapter={chapter}
                courseSlug={courseSlug}
                index={index}
                key={chapter.slug}
                orgSlug={orgSlug}
              />
            ))}
          </EditorListContent>
        </EditorSortableList>
      )}
    </EditorListProvider>
  );
}
