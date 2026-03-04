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
import { ReviewedList } from "./reviewed-list";

function ReviewedListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export default async function ReviewedItemsPage({
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
          <ContainerTitle>{getTaskLabel(taskType)} — Reviewed</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ReviewedListSkeleton />}>
          <ReviewedList taskType={taskType} searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
