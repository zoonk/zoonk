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
import { isUuid } from "@zoonk/utils/uuid";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserAccount } from "./user-account";
import { UserCourses } from "./user-courses";
import { UserHeader } from "./user-header";
import { UserLesson } from "./user-lesson";
import { UserSubscription } from "./user-subscription";

function UserBreadcrumb() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/users" prefetch />}>Users</BreadcrumbLink>
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

/**
 * The account shell and breadcrumb do not depend on the dynamic user id, so
 * they remain available while the requested account content streams in.
 */
export default function UserDetailPage({ params }: PageProps<"/users/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <UserBreadcrumb />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <Suspense fallback={<UserDetailSkeleton />}>
          <UserDetailContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

/**
 * Parameter validation must happen after the dynamic route value resolves and
 * before any independent account query receives the user id.
 */
async function UserDetailContent({ params }: Pick<PageProps<"/users/[id]">, "params">) {
  const { id: userId } = await params;

  if (!isUuid(userId)) {
    notFound();
  }

  return (
    <>
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

      <Suspense fallback={<SectionSkeleton />}>
        <UserCourses userId={userId} />
      </Suspense>
    </>
  );
}

/**
 * The dynamic-route fallback mirrors every independently streamed account
 * section so the page remains stable until the user id is available.
 */
function UserDetailSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <SectionSkeleton />
      <SectionSkeleton />
      <SectionSkeleton />
      <SectionSkeleton />
    </>
  );
}
