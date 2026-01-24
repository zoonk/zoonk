import { BackLink } from "@/components/back-link";
import { getChapter } from "@/data/chapters/get-chapter";

export async function LessonBackLink({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">["params"];
}) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await params;

  const { data: chapter } = await getChapter({
    chapterSlug,
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!chapter) {
    return null;
  }

  return (
    <BackLink href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}`}>
      {chapter.title}
    </BackLink>
  );
}
