import { ErrorView } from "@zoonk/ui/patterns/error";
import { SUPPORT_URL } from "@zoonk/utils/constants";
import { getExtracted } from "next-intl/server";
import {
  EditorDragHandle,
  EditorListAddButton,
  EditorListContent,
  EditorListHeader,
  EditorListItem,
  EditorListItemActions,
  EditorListProvider,
  EditorListSpinner,
  EditorSortableItem,
  EditorSortableItemRow,
  EditorSortableList,
} from "@/components/editor-list";
import { EntityListActions } from "@/components/entity-list-actions";
import { listLessonActivities } from "@/data/activities/list-lesson-activities";
import { getLesson } from "@/data/lessons/get-lesson";
import {
  exportActivitiesAction,
  handleImportActivitiesAction,
  insertActivityAction,
  reorderActivitiesAction,
} from "./activity-actions";
import { ActivityListItemLink } from "./activity-list-item-link";

type LessonPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

export async function ActivityList({
  params,
}: {
  params: LessonPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, lessonSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lesson } = await getLesson({
    chapterSlug,
    courseSlug,
    language: lang,
    lessonSlug,
    orgSlug,
  });

  if (!lesson) {
    return (
      <ErrorView
        description={t("We couldn't load the activities. Please try again.")}
        retryLabel={t("Try again")}
        supportHref={SUPPORT_URL}
        supportLabel={t("Contact support")}
        title={t("Failed to load activities")}
      />
    );
  }

  const lessonId = lesson.id;

  const { data: activities, error } = await listLessonActivities({
    lessonId,
    orgId: lesson.organizationId,
  });

  if (error) {
    return (
      <ErrorView
        description={t("We couldn't load the activities. Please try again.")}
        retryLabel={t("Try again")}
        supportHref={SUPPORT_URL}
        supportLabel={t("Contact support")}
        title={t("Failed to load activities")}
      />
    );
  }

  const routeParams = {
    chapterSlug,
    courseSlug,
    lang,
    lessonId,
    lessonSlug,
    orgSlug,
  };

  const lastActivity = activities.at(-1);
  const endPosition = lastActivity ? lastActivity.position + 1 : 0;

  return (
    <EditorListProvider onInsert={insertActivityAction.bind(null, routeParams)}>
      <EditorListSpinner />

      <EditorListHeader>
        <EditorListAddButton position={endPosition}>
          {t("Add activity")}
        </EditorListAddButton>

        <EntityListActions
          entityType="activities"
          onExport={exportActivitiesAction.bind(null, lessonId)}
          onImport={handleImportActivitiesAction.bind(null, routeParams)}
        />
      </EditorListHeader>

      {activities.length > 0 && (
        <EditorSortableList
          items={activities.map((a) => ({ ...a, id: Number(a.id) }))}
          onReorder={reorderActivitiesAction.bind(null, routeParams)}
        >
          <EditorListContent>
            {activities.map((activity, index) => (
              <EditorSortableItem
                id={Number(activity.id)}
                key={String(activity.id)}
              >
                <EditorListItem>
                  <EditorSortableItemRow>
                    <EditorDragHandle aria-label={t("Drag to reorder")}>
                      {index + 1}
                    </EditorDragHandle>

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
            ))}
          </EditorListContent>
        </EditorSortableList>
      )}
    </EditorListProvider>
  );
}
