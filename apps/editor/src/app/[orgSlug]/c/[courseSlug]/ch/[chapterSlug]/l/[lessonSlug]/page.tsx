import { BackLinkSkeleton } from "@/components/back-link";
import { ContentEditorSkeleton } from "@/components/content-editor";
import { EditorListSkeleton } from "@/components/editor-list";
import { SlugEditorSkeleton } from "@/components/slug-editor";
import { getLesson } from "@/data/lessons/get-lesson";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ActivityList } from "./activity-list";
import { LessonBackLink } from "./lesson-back-link";
import { LessonContent } from "./lesson-content";
import { LessonSlug } from "./lesson-slug";

export async function generateMetadata({
  params,
}: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">): Promise<Metadata> {
  const { chapterSlug, courseSlug, lessonSlug, orgSlug } = await params;
  const { data: lesson } = await getLesson({ chapterSlug, courseSlug, lessonSlug, orgSlug });

  if (!lesson) {
    return {};
  }

  return { title: lesson.title };
}

export default function LessonPage(
  props: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">,
) {
  return (
    <Container variant="narrow">
      <Suspense fallback={<BackLinkSkeleton />}>
        <LessonBackLink params={props.params} />
      </Suspense>

      <Suspense fallback={<ContentEditorSkeleton />}>
        <LessonContent params={props.params} />
      </Suspense>

      <ContainerBody>
        <Suspense fallback={<SlugEditorSkeleton />}>
          <LessonSlug params={props.params} />
        </Suspense>
      </ContainerBody>

      <Suspense fallback={<EditorListSkeleton />}>
        <ActivityList params={props.params} />
      </Suspense>
    </Container>
  );
}
