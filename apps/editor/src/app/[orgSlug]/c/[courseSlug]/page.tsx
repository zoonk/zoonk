import { AlternativeTitlesSkeleton } from "@/components/alternative-titles/alternative-titles-editor";
import { CategoryEditorSkeleton } from "@/components/category/category-editor";
import { ContentEditorSkeleton } from "@/components/content-editor";
import { EditorListSkeleton } from "@/components/editor-list";
import { SlugEditorSkeleton } from "@/components/slug-editor";
import { getCourse } from "@/data/courses/get-course";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { ImageUploadSkeleton } from "@zoonk/ui/components/image-upload";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ChapterList } from "./chapter-list";
import { CourseAlternativeTitles } from "./course-alternative-titles";
import { CourseCategories } from "./course-categories";
import { CourseContent } from "./course-content";
import { CourseImage } from "./course-image";
import { CourseSlug } from "./course-slug";

export async function generateMetadata({
  params,
}: PageProps<"/[orgSlug]/c/[courseSlug]">): Promise<Metadata> {
  const { courseSlug, orgSlug } = await params;
  const { data: course } = await getCourse({ courseSlug, orgSlug });

  if (!course) {
    return {};
  }

  return { title: course.title };
}

export default function CoursePage(props: PageProps<"/[orgSlug]/c/[courseSlug]">) {
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
