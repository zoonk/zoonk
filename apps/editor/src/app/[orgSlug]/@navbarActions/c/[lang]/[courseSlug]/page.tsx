import { getCourse } from "@zoonk/core/courses";
import { Suspense } from "react";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { togglePublishAction } from "./actions";

async function CoursePublishToggle({
  params,
}: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">) {
  const { courseSlug, lang, orgSlug } = await params;

  const { data: course } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!course) {
    return <PublishToggle isPublished={false} />;
  }

  return (
    <PublishToggle
      isPublished={course.isPublished}
      onToggle={togglePublishAction.bind(null, course.id)}
    />
  );
}

export default async function CourseNavbarActions(
  props: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">,
) {
  return (
    <Suspense fallback={<PublishToggle isPublished={false} />}>
      <CoursePublishToggle {...props} />
    </Suspense>
  );
}
