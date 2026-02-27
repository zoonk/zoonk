import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getCourse } from "@/data/courses/get-course";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { getExtracted } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { deleteCourseAction, togglePublishAction } from "./actions";
import { CourseActionsContainer } from "./course-actions-container";

export async function CourseActions({ params }: PageProps<"/[orgSlug]/c/[courseSlug]">) {
  const { courseSlug, orgSlug } = await params;
  const t = await getExtracted();
  const courseUrl = `/${orgSlug}/c/${courseSlug}`;

  const { data: course } = await getCourse({ courseSlug, orgSlug });

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
        onToggle={togglePublishAction.bind(null, { courseId: course.id, courseUrl })}
      />

      {canDelete && (
        <DeleteItemButton
          onDelete={deleteCourseAction.bind(null, orgSlug, course.id)}
          srLabel={t("Delete course")}
          title={t("Delete course?")}
        />
      )}
    </CourseActionsContainer>
  );
}
