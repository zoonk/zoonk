import { SlugEditor } from "@/components/slug-editor";
import { getChapter } from "@/data/chapters/get-chapter";
import { getCourse } from "@/data/courses/get-course";
import { checkChapterSlugExists, updateChapterSlugAction } from "./actions";

export async function ChapterSlug({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]">["params"];
}) {
  const { chapterSlug, courseSlug, orgSlug } = await params;

  const [{ data: chapter }, { data: course }] = await Promise.all([
    getChapter({ chapterSlug, courseSlug, orgSlug }),
    getCourse({ courseSlug, orgSlug }),
  ]);

  if (!chapter || !course) {
    return null;
  }

  return (
    <SlugEditor
      checkFn={checkChapterSlugExists}
      courseId={chapter.courseId}
      entityId={chapter.id}
      initialSlug={chapter.slug}
      language={course.language}
      onSave={updateChapterSlugAction.bind(null, chapterSlug, courseSlug)}
      orgSlug={orgSlug}
      redirectPrefix={`/${orgSlug}/c/${courseSlug}/ch/`}
    />
  );
}
