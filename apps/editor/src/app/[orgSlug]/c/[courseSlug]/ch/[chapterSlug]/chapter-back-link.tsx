import { BackLink } from "@/components/back-link";
import { getCourse } from "@/data/courses/get-course";

export async function ChapterBackLink({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]">["params"];
}) {
  const { courseSlug, orgSlug } = await params;
  const { data: course } = await getCourse({ courseSlug, orgSlug });

  if (!course) {
    return null;
  }

  return <BackLink href={`/${orgSlug}/c/${courseSlug}`}>{course.title}</BackLink>;
}
