import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { getLesson } from "@/data/lessons/get-lesson";
import { deleteLessonAction, togglePublishAction } from "./actions";

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
}: PageProps<"/[orgSlug]/l/[lessonSlug]">) {
  const { lessonSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: lesson } = await getLesson({
    lessonSlug,
    orgSlug,
  });

  if (!lesson) {
    return notFound();
  }

  return (
    <LessonActionsContainer>
      <PublishToggle
        isPublished={lesson.isPublished}
        onToggle={togglePublishAction.bind(null, lesson.id)}
      />

      <DeleteItemButton
        onDelete={deleteLessonAction.bind(null, lesson.id, orgSlug)}
        srLabel={t("Delete lesson")}
        title={t("Delete lesson?")}
      />
    </LessonActionsContainer>
  );
}

export default async function LessonNavbarActions(
  props: PageProps<"/[orgSlug]/l/[lessonSlug]">,
) {
  return (
    <Suspense fallback={<LessonActionsSkeleton />}>
      <LessonActions {...props} />
    </Suspense>
  );
}
