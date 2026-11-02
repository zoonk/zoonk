import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { getSource } from "@/data/sources/get-source";
import { capitalize } from "@/lib/format";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FreshnessCommandForm } from "../freshness-command-form";
import { SourceChangeNotices } from "./source-change-notices";
import { SourceCitations } from "./source-citations";
import { SourcePrivateDetails } from "./source-private-details";
import { SourcePublicDetails } from "./source-public-details";

export async function generateMetadata({ params }: PageProps<"/sources/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getSource(id);

  if (!record) {
    notFound();
  }

  return { title: record.visibility === "private" ? "Private upload" : record.title };
}

const SOURCE_PARENTS = [{ href: "/sources", label: "Sources" }];

export default function SourceDetailPage({ params }: PageProps<"/sources/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<SourceDetailSkeleton />}>
        <SourceDetailContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

/** A private upload is personal data, so it gets a metadata-only view. */
async function SourceDetailContent({ params }: Pick<PageProps<"/sources/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const source = await getSource(id);

  if (!source) {
    notFound();
  }

  const facts = [capitalize(source.kind), source.language.toUpperCase()];

  return (
    <>
      {source.visibility === "private" ? (
        <AdminDetailHeader facts={facts} parents={SOURCE_PARENTS} title="Private upload" />
      ) : (
        <AdminDetailHeader
          actions={
            source.url ? <FreshnessCommandForm targetId={source.id} targetKind="source" /> : null
          }
          facts={[source.publisher, ...facts]}
          parents={SOURCE_PARENTS}
          title={source.title}
        />
      )}

      <AdminDetailBody>
        {source.visibility === "private" ? (
          <SourcePrivateDetails source={source} />
        ) : (
          <SourcePublicDetails source={source} />
        )}

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <SourceChangeNotices sourceId={source.id} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <SourceCitations sourceId={source.id} />
        </Suspense>
      </AdminDetailBody>
    </>
  );
}

function SourceDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton actions="buttons" parents={SOURCE_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton rows={7} />
        <AdminSectionSkeleton />
      </AdminDetailBody>
    </>
  );
}
