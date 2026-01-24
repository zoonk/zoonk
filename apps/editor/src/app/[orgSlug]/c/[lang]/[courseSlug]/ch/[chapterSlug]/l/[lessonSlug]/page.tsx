import { BackLinkSkeleton } from "@/components/back-link";
import { ContentEditorSkeleton } from "@/components/content-editor";
import { EditorListSkeleton } from "@/components/editor-list";
import { SlugEditorSkeleton } from "@/components/slug-editor";
import { getChapter } from "@/data/chapters/get-chapter";
import { getLesson } from "@/data/lessons/get-lesson";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Suspense } from "react";
import { ActivityList } from "./activity-list";
import { LessonBackLink } from "./lesson-back-link";
import { LessonContent } from "./lesson-content";
import { LessonSlug } from "./lesson-slug";

export default async function LessonPage(
  props: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">,
) {
  const { chapterSlug, courseSlug, lang, lessonSlug, orgSlug } = await props.params;

  // Preload data in parallel (cached, so child components get the same promise)
  void Promise.all([
    getChapter({ chapterSlug, courseSlug, language: lang, orgSlug }),
    getLesson({
      chapterSlug,
      courseSlug,
      language: lang,
      lessonSlug,
      orgSlug,
    }),
  ]);

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
