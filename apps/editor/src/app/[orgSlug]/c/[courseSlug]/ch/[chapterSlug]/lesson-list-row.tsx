import {
  EditorDragHandle,
  EditorListItem,
  EditorListItemActions,
  EditorSortableItem,
  EditorSortableItemRow,
} from "@/components/editor-list";
import { getExtracted } from "next-intl/server";
import { LessonListItemLink } from "./lesson-list-item-link";

export async function LessonListRow({
  chapterSlug,
  courseSlug,
  index,
  lesson,
  orgSlug,
}: {
  chapterSlug: string;
  courseSlug: string;
  index: number;
  lesson: { id: number; slug: string; title: string; description: string | null };
  orgSlug: string;
}) {
  const t = await getExtracted();

  return (
    <EditorSortableItem id={lesson.id} key={lesson.slug}>
      <EditorListItem>
        <EditorSortableItemRow>
          <EditorDragHandle aria-label={t("Drag to reorder")}>{index + 1}</EditorDragHandle>

          <LessonListItemLink
            chapterSlug={chapterSlug}
            courseSlug={courseSlug}
            description={lesson.description}
            lessonSlug={lesson.slug}
            orgSlug={orgSlug}
            title={lesson.title}
          />

          <EditorListItemActions
            aria-label={t("Lesson actions")}
            insertAboveLabel={t("Insert above")}
            insertBelowLabel={t("Insert below")}
            position={index}
          />
        </EditorSortableItemRow>
      </EditorListItem>
    </EditorSortableItem>
  );
}
