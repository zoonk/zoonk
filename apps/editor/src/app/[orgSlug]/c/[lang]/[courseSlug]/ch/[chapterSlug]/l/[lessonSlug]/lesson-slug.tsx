import { SlugEditor } from "@/components/slug-editor";
import { getLesson } from "@/data/lessons/get-lesson";
import { checkLessonSlugExists, updateLessonSlugAction } from "./actions";

type LessonPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

export async function LessonSlug({
  params,
}: {
  params: LessonPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, lessonSlug, orgSlug } = await params;

  const { data: lesson } = await getLesson({
    chapterSlug,
    courseSlug,
    language: lang,
    lessonSlug,
    orgSlug,
  });

  if (!lesson) {
    return null;
  }

  const slugs = { chapterSlug, courseSlug, lessonSlug };

  return (
    <SlugEditor
      chapterId={lesson.chapterId}
      checkFn={checkLessonSlugExists}
      entityId={lesson.id}
      initialSlug={lesson.slug}
      language={lang}
      onSave={updateLessonSlugAction.bind(null, slugs)}
      orgSlug={orgSlug}
      redirectPrefix={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/`}
    />
  );
}
