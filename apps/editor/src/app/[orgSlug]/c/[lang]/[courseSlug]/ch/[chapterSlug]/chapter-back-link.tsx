import { BackLink } from "@/components/back-link";
import { getCourse } from "@/data/courses/get-course";

type ChapterPageProps = PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">;

export async function ChapterBackLink({ params }: { params: ChapterPageProps["params"] }) {
  const { courseSlug, lang, orgSlug } = await params;
  const { data: course } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!course) {
    return null;
  }

  return <BackLink href={`/${orgSlug}/c/${lang}/${courseSlug}`}>{course.title}</BackLink>;
}
