import {
  type ReviewTaskType,
  getTaskLabel,
  getTaskPath,
  resolveTaskType,
} from "@/lib/review-utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@zoonk/ui/components/breadcrumb";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { parseBigIntId } from "@zoonk/utils/string";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FlaggedItemActions } from "./flagged-item-actions";
import { FlaggedItemContent } from "./flagged-item-content";

function FlaggedItemBreadcrumb({
  taskType,
  entityId,
}: {
  taskType: ReviewTaskType;
  entityId: string;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/review" />}>Review</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={`${getTaskPath(taskType)}?view=flagged`} />}>
            {getTaskLabel(taskType)}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{entityId}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-48 w-full" />
    </div>
  );
}

export default async function FlaggedItemPage({
  params,
}: PageProps<"/review/[group]/[task]/[entityId]">) {
  const { group, task, entityId: rawEntityId } = await params;
  const taskType = resolveTaskType(String(group), String(task));

  if (!taskType) {
    notFound();
  }

  const entityId = parseBigIntId(String(rawEntityId));

  if (!entityId) {
    notFound();
  }

  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <FlaggedItemBreadcrumb taskType={taskType} entityId={entityId.toString()} />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="max-w-2xl gap-8">
        <Suspense fallback={<ContentSkeleton />}>
          <FlaggedItemContent taskType={taskType} entityId={entityId} />
        </Suspense>

        <FlaggedItemActions taskType={taskType} entityId={entityId.toString()} />
      </ContainerBody>
    </Container>
  );
}
