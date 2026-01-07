import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import type { Route } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getLesson } from "@/data/lessons/get-lesson";
import { deleteLessonAction, togglePublishAction } from "./actions";
import { LessonActionsContainer } from "./lesson-actions-container";

type LessonNavbarActionsPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

export async function LessonActions({
  params,
}: {
  params: LessonNavbarActionsPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, lessonSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lesson } = await getLesson({
    language: lang,
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
    `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}` as Route;
  const lessonUrl = `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`;

  const slugs = { chapterSlug, courseSlug, lessonSlug };

  return (
    <LessonActionsContainer>
      <PublishToggle
        isPublished={lesson.isPublished}
        onToggle={togglePublishAction.bind(null, slugs, lessonUrl, lesson.id)}
      />

      {canDelete && (
        <DeleteItemButton
          onDelete={deleteLessonAction.bind(null, slugs, lesson.id, chapterUrl)}
          srLabel={t("Delete lesson")}
          title={t("Delete lesson?")}
        />
      )}
    </LessonActionsContainer>
  );
}
