import { SlugEditor } from "@/components/slug-editor";
import { getCourse } from "@/data/courses/get-course";
import { getLesson } from "@/data/lessons/get-lesson";
import { checkLessonSlugExists, updateLessonSlugAction } from "./actions";

export async function LessonSlug({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">["params"];
}) {
  const { chapterSlug, courseSlug, lessonSlug, orgSlug } = await params;

  const [{ data: lesson }, { data: course }] = await Promise.all([
    getLesson({ chapterSlug, courseSlug, lessonSlug, orgSlug }),
    getCourse({ courseSlug, orgSlug }),
  ]);

  if (!lesson || !course) {
    return null;
  }

  const slugs = { chapterSlug, courseSlug, lessonSlug };

  return (
    <SlugEditor
      chapterId={lesson.chapterId}
      checkFn={checkLessonSlugExists}
      entityId={lesson.id}
      initialSlug={lesson.slug}
      language={course.language}
      onSave={updateLessonSlugAction.bind(null, slugs)}
      orgSlug={orgSlug}
      redirectPrefix={`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}/l/`}
    />
  );
}
