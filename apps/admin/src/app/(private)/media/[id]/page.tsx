import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import { AdminSectionSkeleton } from "@/components/admin-section";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MediaOverview } from "./media-overview";
import { MediaUsage } from "./media-usage";

export const metadata: Metadata = { title: "Media asset" };

export default function MediaDetailPage({ params }: PageProps<"/media/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb current="Media asset" parents={[{ href: "/media", label: "Media" }]} />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <Suspense fallback={<MediaDetailSkeleton />}>
          <MediaDetailContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function MediaDetailContent({ params }: Pick<PageProps<"/media/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  return (
    <>
      <Suspense fallback={<AdminSectionSkeleton />}>
        <MediaOverview mediaAssetId={id} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <MediaUsage mediaAssetId={id} />
      </Suspense>
    </>
  );
}

function MediaDetailSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
