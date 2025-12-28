import type { Route } from "next";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getLesson } from "@/data/lessons/get-lesson";
import { deleteLessonAction, togglePublishAction } from "./actions";

type LessonNavbarActionsPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

function LessonActionsContainer({ children }: React.PropsWithChildren) {
  return <div className="flex items-center gap-2">{children}</div>;
}

function LessonActionsSkeleton() {
  return (
    <LessonActionsContainer>
      <PublishToggle isPublished={false} />
      <DeleteItemButton />
    </LessonActionsContainer>
  );
}

async function LessonActions({
  params,
}: {
  params: LessonNavbarActionsPageProps["params"];
}) {
  const { chapterSlug, courseSlug, lang, lessonSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lesson } = await getLesson({
    language: lang,
    lessonSlug,
    orgSlug,
  });

  if (!lesson) {
    return notFound();
  }

  const chapterUrl =
    `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}` as Route;

  const slugs = { chapterSlug, courseSlug, lessonSlug };

  return (
    <LessonActionsContainer>
      <PublishToggle
        isPublished={lesson.isPublished}
        onToggle={togglePublishAction.bind(null, slugs, lesson.id)}
      />

      <DeleteItemButton
        onDelete={deleteLessonAction.bind(null, slugs, lesson.id, chapterUrl)}
        srLabel={t("Delete lesson")}
        title={t("Delete lesson?")}
      />
    </LessonActionsContainer>
  );
}

export default async function LessonNavbarActions(
  props: LessonNavbarActionsPageProps,
) {
  return (
    <Suspense fallback={<LessonActionsSkeleton />}>
      <LessonActions params={props.params} />
    </Suspense>
  );
}
