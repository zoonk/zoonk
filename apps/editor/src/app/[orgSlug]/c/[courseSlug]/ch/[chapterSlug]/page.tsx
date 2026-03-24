import { BackLinkSkeleton } from "@/components/back-link";
import { ContentEditorSkeleton } from "@/components/content-editor";
import { EditorListSkeleton } from "@/components/editor-list";
import { SlugEditorSkeleton } from "@/components/slug-editor";
import { getChapter } from "@/data/chapters/get-chapter";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { ChapterBackLink } from "./chapter-back-link";
import { ChapterContent } from "./chapter-content";
import { ChapterSlug } from "./chapter-slug";
import { LessonList } from "./lesson-list";

export async function generateMetadata({
  params,
}: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]">): Promise<Metadata> {
  const { chapterSlug, courseSlug, orgSlug } = await params;
  const { data: chapter } = await getChapter({ chapterSlug, courseSlug, orgSlug });

  if (!chapter) {
    return {};
  }

  return { title: chapter.title };
}

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
