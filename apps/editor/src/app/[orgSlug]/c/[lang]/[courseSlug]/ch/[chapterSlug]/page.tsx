import { Container } from "@zoonk/ui/components/container";
import { Suspense } from "react";
import { BackLinkSkeleton } from "@/components/back-link";
import { ContentEditorSkeleton } from "@/components/content-editor";
import { ItemListSkeleton } from "@/components/item-list";
import { SlugEditorSkeleton } from "@/components/slug-editor";
import { getChapter } from "@/data/chapters/get-chapter";
import { getCourse } from "@/data/courses/get-course";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { ChapterBackLink } from "./chapter-back-link";
import { ChapterContent } from "./chapter-content";
import { ChapterSlug } from "./chapter-slug";
import { LessonList } from "./lesson-list";

type ChapterPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">;

export default async function ChapterPage(props: ChapterPageProps) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await props.params;

  // Preload data in parallel (cached, so child components get the same promise)
  void Promise.all([
    getCourse({ courseSlug, language: lang, orgSlug }),
    getChapter({ chapterSlug, language: lang, orgSlug }),
    listChapterLessons({ chapterSlug, orgSlug }),
  ]);

  return (
    <Container variant="narrow">
      <Suspense fallback={<BackLinkSkeleton />}>
        <ChapterBackLink params={props.params} />
      </Suspense>

      <Suspense fallback={<ContentEditorSkeleton />}>
        <ChapterContent params={props.params} />
      </Suspense>

      <Suspense fallback={<SlugEditorSkeleton />}>
        <ChapterSlug params={props.params} />
      </Suspense>

      <Suspense fallback={<ItemListSkeleton />}>
        <LessonList params={props.params} />
      </Suspense>
    </Container>
  );
}
