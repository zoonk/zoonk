import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { ImageUploadSkeleton } from "@zoonk/ui/components/image-upload";
import { Suspense } from "react";
import { AlternativeTitlesSkeleton } from "@/components/alternative-titles-editor";
import { CategoryEditorSkeleton } from "@/components/category-editor";
import { ContentEditorSkeleton } from "@/components/content-editor";
import { EditorListSkeleton } from "@/components/editor-list";
import { SlugEditorSkeleton } from "@/components/slug-editor";
import { listCourseCategories } from "@/data/categories/list-course-categories";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { ChapterList } from "./chapter-list";
import { CourseAlternativeTitles } from "./course-alternative-titles";
import { CourseCategories } from "./course-categories";
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
    listCourseCategories({ courseSlug, language: lang, orgSlug }),
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

      <ContainerBody>
        <Suspense fallback={<CategoryEditorSkeleton />}>
          <CourseCategories params={props.params} />
        </Suspense>

        <Suspense fallback={<SlugEditorSkeleton />}>
          <CourseSlug params={props.params} />
        </Suspense>

        <Suspense fallback={<AlternativeTitlesSkeleton />}>
          <CourseAlternativeTitles params={props.params} />
        </Suspense>
      </ContainerBody>

      <Suspense fallback={<EditorListSkeleton />}>
        <ChapterList params={props.params} />
      </Suspense>
    </Container>
  );
}
