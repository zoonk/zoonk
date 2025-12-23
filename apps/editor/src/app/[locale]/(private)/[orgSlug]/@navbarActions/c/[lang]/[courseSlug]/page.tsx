import { getCourse } from "@zoonk/core/courses";
import { Suspense } from "react";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { togglePublishAction } from "./actions";

async function CoursePublishToggle({
  courseSlug,
  language,
  orgSlug,
}: {
  courseSlug: string;
  language: string;
  orgSlug: string;
}) {
  const { data: course } = await getCourse({
    courseSlug,
    language,
    orgSlug,
  });

  if (!course) {
    return <PublishToggle isPublished={false} />;
  }

  const handleToggle = togglePublishAction.bind(null, course.id, orgSlug);

  return (
    <PublishToggle isPublished={course.isPublished} onToggle={handleToggle} />
  );
}

export default async function CourseNavbarActions({
  params,
}: PageProps<"/[locale]/[orgSlug]/c/[lang]/[courseSlug]">) {
  const { courseSlug, lang, orgSlug } = await params;

  return (
    <Suspense fallback={<PublishToggle isPublished={false} />}>
      <CoursePublishToggle
        courseSlug={courseSlug}
        language={lang}
        orgSlug={orgSlug}
      />
    </Suspense>
  );
}
