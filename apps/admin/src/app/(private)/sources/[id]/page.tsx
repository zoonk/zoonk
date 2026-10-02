import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { getSource } from "@/data/sources/get-source";
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
import { SourceChangeNotices } from "./source-change-notices";
import { SourceCitations } from "./source-citations";
import { SourcePrivateDetails } from "./source-private-details";
import { SourcePublicDetails } from "./source-public-details";

export const metadata: Metadata = { title: "Source" };

export default function SourceDetailPage({ params }: PageProps<"/sources/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <AdminBreadcrumb current="Source" parents={[{ href: "/sources", label: "Sources" }]} />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <Suspense fallback={<SourceDetailSkeleton />}>
          <SourceDetailContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

/**
 * Visibility decides the whole page: a private upload is personal data, so it
 * gets a metadata-only view and the notices and citations sections stay empty.
 */
async function SourceDetailContent({ params }: Pick<PageProps<"/sources/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  return (
    <>
      <Suspense fallback={<AdminSectionSkeleton />}>
        <SourceOverview sourceId={id} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <SourceChangeNotices sourceId={id} />
      </Suspense>

      <Suspense fallback={<AdminSectionSkeleton />}>
        <SourceCitations sourceId={id} />
      </Suspense>
    </>
  );
}

async function SourceOverview({ sourceId }: { sourceId: string }) {
  "use cache: private";

  const source = await getSource(sourceId);

  if (!source) {
    notFound();
  }

  return source.visibility === "private" ? (
    <SourcePrivateDetails source={source} />
  ) : (
    <SourcePublicDetails source={source} />
  );
}

function SourceDetailSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
