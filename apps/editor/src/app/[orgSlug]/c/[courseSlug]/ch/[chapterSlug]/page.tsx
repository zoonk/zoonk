import { BackLinkSkeleton } from "@/components/back-link";
import { ContentEditorSkeleton } from "@/components/content-editor";
import { EditorListSkeleton } from "@/components/editor-list";
import { SlugEditorSkeleton } from "@/components/slug-editor";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Suspense } from "react";
import { ChapterBackLink } from "./chapter-back-link";
import { ChapterContent } from "./chapter-content";
import { ChapterSlug } from "./chapter-slug";
import { LessonList } from "./lesson-list";

export default function ChapterPage(
  props: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]">,
) {
  return (
    <Container variant="narrow">
      <Suspense fallback={<BackLinkSkeleton />}>
        <ChapterBackLink params={props.params} />
      </Suspense>

      <Suspense fallback={<ContentEditorSkeleton />}>
        <ChapterContent params={props.params} />
      </Suspense>

      <ContainerBody>
        <Suspense fallback={<SlugEditorSkeleton />}>
          <ChapterSlug params={props.params} />
        </Suspense>
      </ContainerBody>

      <Suspense fallback={<EditorListSkeleton />}>
        <LessonList params={props.params} />
      </Suspense>
    </Container>
  );
}
