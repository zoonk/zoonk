import { parseOptionalSearchParam } from "@/lib/parse-search-params";
import { getTaskLabel, resolveTaskType } from "@/lib/review-utils";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FlaggedList } from "./flagged-list";
import { LessonSlugFilter } from "./lesson-slug-filter";
import { ReviewQueue } from "./review-queue";
import { ReviewTabs } from "./review-tabs";

function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-48 w-full" />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}

export default async function ReviewTaskPage({
  params,
  searchParams,
}: PageProps<"/review/[group]/[task]">) {
  const { group, task } = await params;
  const taskType = resolveTaskType(group, task);

  if (!taskType) {
    notFound();
  }

  const resolvedParams = await searchParams;
  const view = parseOptionalSearchParam(resolvedParams.view);
  const currentId = parseOptionalSearchParam(resolvedParams.current);

  const lessonSlug =
    taskType === "stepImage" ? parseOptionalSearchParam(resolvedParams.lessonSlug) : undefined;

  const showLessonSlugFilter = taskType === "stepImage" && view !== "flagged";

  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>{getTaskLabel(taskType)}</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<Skeleton className="h-8 w-64" />}>
          <ReviewTabs taskType={taskType} view={view} />
        </Suspense>

        {showLessonSlugFilter ? <LessonSlugFilter lessonSlug={lessonSlug} /> : null}

        <Suspense fallback={<QueueSkeleton />}>
          {view === "flagged" ? (
            <FlaggedList taskType={taskType} searchParams={searchParams} />
          ) : (
            <ReviewQueue taskType={taskType} currentId={currentId} lessonSlug={lessonSlug} />
          )}
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
