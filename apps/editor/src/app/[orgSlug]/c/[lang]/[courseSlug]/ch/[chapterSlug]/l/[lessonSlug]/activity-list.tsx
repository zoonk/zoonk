import {
  EditorListAddButton,
  EditorListContent,
  EditorListHeader,
  EditorListProvider,
  EditorListSpinner,
  EditorSortableList,
} from "@/components/editor-list";
import { EntityListActions } from "@/components/entity/entity-list-actions";
import { listLessonActivities } from "@/data/activities/list-lesson-activities";
import { getLesson } from "@/data/lessons/get-lesson";
import { ErrorView } from "@zoonk/ui/patterns/error";
import { SUPPORT_URL } from "@zoonk/utils/constants";
import { getExtracted } from "next-intl/server";
import {
  exportActivitiesAction,
  handleImportActivitiesAction,
  insertActivityAction,
  reorderActivitiesAction,
} from "./activity-actions";
import { ActivityListRow } from "./activity-list-row";

type LessonPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

export async function ActivityList({ params }: { params: LessonPageProps["params"] }) {
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
        <EditorListAddButton position={endPosition}>{t("Add activity")}</EditorListAddButton>

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
              <ActivityListRow
                activity={activity}
                chapterSlug={chapterSlug}
                courseSlug={courseSlug}
                index={index}
                key={String(activity.id)}
                lang={lang}
                lessonSlug={lessonSlug}
                orgSlug={orgSlug}
              />
            ))}
          </EditorListContent>
        </EditorSortableList>
      )}
    </EditorListProvider>
  );
}
