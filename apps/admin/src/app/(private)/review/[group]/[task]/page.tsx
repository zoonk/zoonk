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
import { ReviewQueue } from "./review-queue";

function ReviewQueueSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-48 w-full" />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}

export default async function ReviewTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string; task: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { group, task } = await params;
  const taskType = resolveTaskType(group, task);

  if (!taskType) {
    notFound();
  }

  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>{getTaskLabel(taskType)}</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ReviewQueueSkeleton />}>
          <ReviewQueue taskType={taskType} searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
