import { AlternativeTitlesSkeleton } from "@/components/alternative-titles/alternative-titles-editor";
import { CategoryEditorSkeleton } from "@/components/category/category-editor";
import { ContentEditorSkeleton } from "@/components/content-editor";
import { EditorListSkeleton } from "@/components/editor-list";
import { SlugEditorSkeleton } from "@/components/slug-editor";
import { listCourseCategories } from "@/data/categories/list-course-categories";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { ImageUploadSkeleton } from "@zoonk/ui/components/image-upload";
import { Suspense } from "react";
import { ChapterList } from "./chapter-list";
import { CourseAlternativeTitles } from "./course-alternative-titles";
import { CourseCategories } from "./course-categories";
import { CourseContent } from "./course-content";
import { CourseImage } from "./course-image";
import { CourseSlug } from "./course-slug";

async function CoursePagePreload({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;

  // Preload data in parallel (cached, so child components get the same promise)
  void Promise.all([
    getCourse({ courseSlug, language: lang, orgSlug }),
    listCourseCategories({ courseSlug, language: lang, orgSlug }),
    listCourseChapters({ courseSlug, language: lang, orgSlug }),
  ]);

  return null;
}

export default function CoursePage(props: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">) {
  return (
    <Container variant="narrow">
      <Suspense>
        <CoursePagePreload params={props.params} />
      </Suspense>

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
