import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getLesson } from "@/data/lessons/get-lesson";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Route } from "next";
import { getExtracted } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { deleteLessonAction, togglePublishAction } from "./actions";
import { LessonActionsContainer } from "./lesson-actions-container";

export async function LessonActions({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">["params"];
}) {
  const { chapterSlug, courseSlug, lessonSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lesson } = await getLesson({
    chapterSlug,
    courseSlug,
    lessonSlug,
    orgSlug,
  });

  if (!lesson) {
    return notFound();
  }

  const canDelete = await hasCoursePermission({
    headers: await headers(),
    orgId: lesson.organizationId,
    permission: lesson.isPublished ? "delete" : "update",
  });

  const chapterUrl =
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- template literal route types require assertion
    `/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}` as Route;
  const lessonUrl = `/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`;

  return (
    <LessonActionsContainer>
      <PublishToggle
        isPublished={lesson.isPublished}
        onToggle={togglePublishAction.bind(null, lessonUrl, lesson.id)}
      />

      {canDelete && (
        <DeleteItemButton
          onDelete={deleteLessonAction.bind(null, lesson.id, chapterUrl)}
          srLabel={t("Delete lesson")}
          title={t("Delete lesson?")}
        />
      )}
    </LessonActionsContainer>
  );
}
