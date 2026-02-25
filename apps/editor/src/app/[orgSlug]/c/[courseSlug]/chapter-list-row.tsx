import {
  EditorDragHandle,
  EditorListItem,
  EditorListItemActions,
  EditorSortableItem,
  EditorSortableItemRow,
} from "@/components/editor-list";
import { getExtracted } from "next-intl/server";
import { ChapterListItemLink } from "./chapter-list-item-link";

export async function ChapterListRow({
  chapter,
  courseSlug,
  index,
  orgSlug,
}: {
  chapter: { id: number; slug: string; title: string; description: string | null };
  courseSlug: string;
  index: number;
  orgSlug: string;
}) {
  const t = await getExtracted();

  return (
    <EditorSortableItem id={chapter.id} key={chapter.slug}>
      <EditorListItem>
        <EditorSortableItemRow>
          <EditorDragHandle aria-label={t("Drag to reorder")}>{index + 1}</EditorDragHandle>

          <ChapterListItemLink
            chapterSlug={chapter.slug}
            courseSlug={courseSlug}
            description={chapter.description}
            orgSlug={orgSlug}
            title={chapter.title}
          />

          <EditorListItemActions
            aria-label={t("Chapter actions")}
            insertAboveLabel={t("Insert above")}
            insertBelowLabel={t("Insert below")}
            position={index}
          />
        </EditorSortableItemRow>
      </EditorListItem>
    </EditorSortableItem>
  );
}
