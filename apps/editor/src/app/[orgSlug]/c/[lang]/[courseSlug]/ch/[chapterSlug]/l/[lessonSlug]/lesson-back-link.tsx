import { BackLink } from "@/components/back-link";
import { getChapter } from "@/data/chapters/get-chapter";

type LessonPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

export async function LessonBackLink({
  params,
}: {
  params: LessonPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await params;

  const { data: chapter } = await getChapter({
    chapterSlug,
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
