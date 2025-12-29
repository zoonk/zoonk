import { Container } from "@zoonk/ui/components/container";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import {
  BackLink,
  BackLinkSkeleton,
} from "@/app/[orgSlug]/_components/back-link";
import { ContentEditor } from "@/app/[orgSlug]/_components/content-editor";
import { ContentEditorSkeleton } from "@/app/[orgSlug]/_components/content-editor-skeleton";
import { getChapter } from "@/data/chapters/get-chapter";
import { getLesson } from "@/data/lessons/get-lesson";
import {
  updateLessonDescriptionAction,
  updateLessonTitleAction,
} from "./actions";

type LessonPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

async function LessonBackLink({
  params,
}: {
  params: LessonPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, orgSlug } = await params;

  const { data: chapter } = await getChapter({
    chapterSlug,
    language: lang,
    orgSlug,
  });

  if (!chapter) {
    return null;
  }

  return (
    <BackLink href={`/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}`}>
      {chapter.title}
    </BackLink>
  );
}

async function LessonContent({
  params,
}: {
  params: LessonPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, lessonSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lesson, error } = await getLesson({
    language: lang,
    lessonSlug,
    orgSlug,
  });

  if (error || !lesson) {
    return notFound();
  }

  const slugs = { chapterSlug, courseSlug, lessonSlug };

  return (
    <ContentEditor
      descriptionLabel={t("Edit lesson description")}
      descriptionPlaceholder={t("Lesson description…")}
      entityId={lesson.id}
      initialDescription={lesson.description}
      initialTitle={lesson.title}
      onSaveDescription={updateLessonDescriptionAction.bind(null, slugs)}
      onSaveTitle={updateLessonTitleAction.bind(null, slugs)}
      titleLabel={t("Edit lesson title")}
      titlePlaceholder={t("Lesson title…")}
    />
  );
}

export default async function LessonPage(props: LessonPageProps) {
  const { chapterSlug, lang, lessonSlug, orgSlug } = await props.params;

  // Preload data in parallel (cached, so child components get the same promise)
  void Promise.all([
    getChapter({ chapterSlug, language: lang, orgSlug }),
    getLesson({ language: lang, lessonSlug, orgSlug }),
  ]);

  return (
    <Container variant="narrow">
      <Suspense fallback={<BackLinkSkeleton />}>
        <LessonBackLink params={props.params} />
      </Suspense>

      <Suspense fallback={<ContentEditorSkeleton />}>
        <LessonContent params={props.params} />
      </Suspense>
    </Container>
  );
}
