import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getCourse } from "@/data/courses/get-course";
import { deleteCourseAction, togglePublishAction } from "./actions";
import { CourseActionsContainer } from "./course-actions-container";

export async function CourseActions({
  params,
}: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">) {
  const { courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();
  const courseUrl = `/${orgSlug}/c/${lang}/${courseSlug}`;

  const { data: course } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!course) {
    return notFound();
  }

  const canDelete = await hasCoursePermission({
    headers: await headers(),
    orgId: course.organizationId,
    permission: course.isPublished ? "delete" : "update",
  });

  return (
    <CourseActionsContainer>
      <PublishToggle
        isPublished={course.isPublished}
        onToggle={togglePublishAction.bind(null, {
          courseId: course.id,
          courseSlug,
          courseUrl,
          orgSlug,
        })}
      />

      {canDelete && (
        <DeleteItemButton
          onDelete={deleteCourseAction.bind(
            null,
            courseSlug,
            orgSlug,
            course.id,
          )}
          srLabel={t("Delete course")}
          title={t("Delete course?")}
        />
      )}
    </CourseActionsContainer>
  );
}
