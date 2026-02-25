import { BackLink } from "@/components/back-link";
import { getChapter } from "@/data/chapters/get-chapter";

export async function LessonBackLink({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">["params"];
}) {
  const { chapterSlug, courseSlug, orgSlug } = await params;

  const { data: chapter } = await getChapter({
    chapterSlug,
    courseSlug,
    orgSlug,
  });

  if (!chapter) {
    return null;
  }

  return (
    <BackLink href={`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}`}>{chapter.title}</BackLink>
  );
}
