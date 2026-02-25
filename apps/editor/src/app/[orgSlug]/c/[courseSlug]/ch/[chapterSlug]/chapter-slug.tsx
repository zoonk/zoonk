import { SlugEditor } from "@/components/slug-editor";
import { getChapter } from "@/data/chapters/get-chapter";
import { checkChapterSlugExists, updateChapterSlugAction } from "./actions";

export async function ChapterSlug({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]">["params"];
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
    <SlugEditor
      checkFn={checkChapterSlugExists}
      courseId={chapter.courseId}
      entityId={chapter.id}
      initialSlug={chapter.slug}
      language={chapter.language}
      onSave={updateChapterSlugAction.bind(null, chapterSlug, courseSlug)}
      orgSlug={orgSlug}
      redirectPrefix={`/${orgSlug}/c/${courseSlug}/ch/`}
    />
  );
}
