import { BackLink, BackLinkSkeleton } from "@/components/back-link";
import { getLesson } from "@/data/lessons/get-lesson";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

type ActivityPageProps =
  PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]/a/[activityId]">;

async function ActivityBackLink({ params }: { params: ActivityPageProps["params"] }) {
  const { chapterSlug, courseSlug, lessonSlug, orgSlug } = await params;
  const t = await getExtracted();
  const { data: lesson } = await getLesson({
    chapterSlug,
    courseSlug,
    lessonSlug,
    orgSlug,
  });

  const lessonTitle = lesson?.title ?? t("Lesson");

  return (
    <BackLink href={`/${orgSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`}>
      {lessonTitle}
    </BackLink>
  );
}

async function ActivityPlaceholder() {
  const t = await getExtracted();

  return (
    <div className="text-muted-foreground py-12 text-center">
      {t("Activity editor coming soon")}
    </div>
  );
}

function ActivityPlaceholderSkeleton() {
  return (
    <div className="py-12 text-center">
      <Skeleton className="mx-auto h-5 w-48" />
    </div>
  );
}

export default function ActivityPage(props: ActivityPageProps) {
  return (
    <Container variant="narrow">
      <Suspense fallback={<BackLinkSkeleton />}>
        <ActivityBackLink params={props.params} />
      </Suspense>

      <ContainerBody>
        <Suspense fallback={<ActivityPlaceholderSkeleton />}>
          <ActivityPlaceholder />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
