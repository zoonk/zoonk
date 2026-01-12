import { SlugEditor } from "@/components/slug-editor";
import { getChapter } from "@/data/chapters/get-chapter";
import { checkChapterSlugExists, updateChapterSlugAction } from "./actions";

type ChapterPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">;

export async function ChapterSlug({
  params,
}: {
  params: ChapterPageProps["params"];
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
    <SlugEditor
      checkFn={checkChapterSlugExists}
      courseId={chapter.courseId}
      entityId={chapter.id}
      initialSlug={chapter.slug}
      language={lang}
      onSave={updateChapterSlugAction.bind(null, chapterSlug, courseSlug)}
      orgSlug={orgSlug}
      redirectPrefix={`/${orgSlug}/c/${lang}/${courseSlug}/ch/`}
    />
  );
}
