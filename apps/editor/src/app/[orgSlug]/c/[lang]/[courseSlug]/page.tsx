import { Container } from "@zoonk/ui/components/container";
import { ImageUploadSkeleton } from "@zoonk/ui/components/image-upload";
import { Suspense } from "react";
import { ContentEditorSkeleton } from "@/components/content-editor";
import { ItemListSkeleton } from "@/components/item-list";
import { SlugEditorSkeleton } from "@/components/slug-editor";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { ChapterList } from "./chapter-list";
import { CourseContent } from "./course-content";
import { CourseImage } from "./course-image";
import { CourseSlug } from "./course-slug";

export default async function CoursePage(
  props: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">,
) {
  const { courseSlug, lang, orgSlug } = await props.params;

  // Preload data in parallel (cached, so child components get the same promise)
  void Promise.all([
    getCourse({ courseSlug, language: lang, orgSlug }),
    listCourseChapters({ courseSlug, language: lang, orgSlug }),
  ]);

  return (
    <Container variant="narrow">
      <Suspense fallback={<ImageUploadSkeleton />}>
        <CourseImage params={props.params} />
      </Suspense>

      <Suspense fallback={<ContentEditorSkeleton />}>
        <CourseContent params={props.params} />
      </Suspense>

      <Suspense fallback={<SlugEditorSkeleton />}>
        <CourseSlug params={props.params} />
      </Suspense>

      <Suspense fallback={<ItemListSkeleton />}>
        <ChapterList params={props.params} />
      </Suspense>
    </Container>
  );
}
