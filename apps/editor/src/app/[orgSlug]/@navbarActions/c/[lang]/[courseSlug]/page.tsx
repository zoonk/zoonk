import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getCourse } from "@/data/courses/get-course";
import { deleteCourseAction, togglePublishAction } from "./actions";

function CourseActionsContainer({ children }: React.PropsWithChildren) {
  return <div className="flex items-center gap-2">{children}</div>;
}

function CourseActionsSkeleton() {
  return (
    <CourseActionsContainer>
      <PublishToggle isPublished={false} />
      <DeleteItemButton />
    </CourseActionsContainer>
  );
}

async function CourseActions({
  params,
}: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">) {
  const { courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const { data: course } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!course) {
    return notFound();
  }

  return (
    <CourseActionsContainer>
      <PublishToggle
        isPublished={course.isPublished}
        onToggle={togglePublishAction.bind(null, courseSlug, course.id)}
      />

      <DeleteItemButton
        onDelete={deleteCourseAction.bind(null, courseSlug, orgSlug, course.id)}
        srLabel={t("Delete course")}
        title={t("Delete course?")}
      />
    </CourseActionsContainer>
  );
}

export default async function CourseNavbarActions(
  props: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">,
) {
  return (
    <Suspense fallback={<CourseActionsSkeleton />}>
      <CourseActions {...props} />
    </Suspense>
  );
}
