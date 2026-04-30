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
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserAccount } from "./user-account";
import { UserHeader } from "./user-header";
import { UserLesson } from "./user-lesson";
import { UserSubscription } from "./user-subscription";

function UserBreadcrumb() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/users" />}>Users</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Details</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export default async function UserDetailPage({ params }: PageProps<"/users/[id]">) {
  const { id: userId } = await params;

  if (!userId) {
    notFound();
  }

  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <UserBreadcrumb />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="max-w-2xl gap-8">
        <Suspense fallback={<HeaderSkeleton />}>
          <UserHeader userId={userId} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <UserAccount userId={userId} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <UserSubscription userId={userId} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <UserLesson userId={userId} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
