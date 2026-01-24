import {
  EditorDragHandle,
  EditorListItem,
  EditorListItemActions,
  EditorSortableItem,
  EditorSortableItemRow,
} from "@/components/editor-list";
import { getExtracted } from "next-intl/server";
import { ActivityListItemLink } from "./activity-list-item-link";

export async function ActivityListRow({
  activity,
  chapterSlug,
  courseSlug,
  index,
  lang,
  lessonSlug,
  orgSlug,
}: {
  activity: {
    id: bigint;
    kind: string;
    title: string | null;
    description: string | null;
  };
  chapterSlug: string;
  courseSlug: string;
  index: number;
  lang: string;
  lessonSlug: string;
  orgSlug: string;
}) {
  const t = await getExtracted();

  return (
    <EditorSortableItem id={Number(activity.id)} key={String(activity.id)}>
      <EditorListItem>
        <EditorSortableItemRow>
          <EditorDragHandle aria-label={t("Drag to reorder")}>{index + 1}</EditorDragHandle>

          <ActivityListItemLink
            activityId={activity.id}
            chapterSlug={chapterSlug}
            courseSlug={courseSlug}
            description={activity.description}
            kind={activity.kind}
            lang={lang}
            lessonSlug={lessonSlug}
            orgSlug={orgSlug}
            title={activity.title}
          />

          <EditorListItemActions
            aria-label={t("Activity actions")}
            insertAboveLabel={t("Insert above")}
            insertBelowLabel={t("Insert below")}
            position={index}
          />
        </EditorSortableItemRow>
      </EditorListItem>
    </EditorSortableItem>
  );
}
