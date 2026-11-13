import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { AdminRecordTabs, readAdminTab } from "@/components/admin-tabs";
import { STAT_TILES_CLASS, StatTileSkeleton } from "@/components/stat-tile";
import { getSource } from "@/data/sources/get-source";
import { capitalize } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FreshnessActions } from "../freshness-actions";
import { SourceChangeNotices } from "./source-change-notices";
import { SourceCitations } from "./source-citations";
import { SourceChecking, SourceDetails, SourceText, SourceTotals } from "./source-overview";
import { SourcePrivateDetails } from "./source-private-details";

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

const SOURCE_TABS = [
  { label: "Overview", value: "overview" },
  { label: "Text", value: "text" },
  { label: "Details", value: "details" },
] as const;

export default function SourceDetailPage({ params, searchParams }: PageProps<"/sources/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<SourceDetailSkeleton />}>
        <SourceDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </AdminDetailPage>
  );
}

/** A private upload is personal data, so it gets a metadata-only view. */
async function SourceDetailContent({ params, searchParams }: PageProps<"/sources/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (!isUuid(id)) {
    notFound();
  }

  const source = await getSource(id);

  if (!source) {
    notFound();
  }

  const facts = [capitalize(source.kind), languageName(source.language)];

  if (source.visibility === "private") {
    return (
      <>
        <AdminDetailHeader facts={facts} parents={SOURCE_PARENTS} title="Private upload" />

        <AdminDetailBody>
          <SourcePrivateDetails source={source} />
        </AdminDetailBody>
      </>
    );
  }

  const tab = readAdminTab({ tabs: SOURCE_TABS, value: query.tab });

  return (
    <>
      <AdminDetailHeader
        actions={
          source.url ? (
            <FreshnessActions
              targetId={source.id}
              targetKind="source"
              targetName={source.title ?? "this source"}
            />
          ) : null
        }
        facts={[source.publisher, ...facts]}
        parents={SOURCE_PARENTS}
        title={source.title ?? "Untitled source"}
      />

      <AdminDetailBody>
        <AdminRecordTabs
          current={tab}
          label="Source"
          path={`/sources/${source.id}`}
          tabs={SOURCE_TABS}
        />

        {tab === "overview" ? (
          <>
            <SourceTotals source={source} />

            <AdminDetailColumns aside={<SourceChecking source={source} />}>
              <Suspense fallback={<AdminSectionSkeleton />}>
                <SourceCitations sourceId={source.id} />
              </Suspense>

              <Suspense fallback={<AdminSectionSkeleton description />}>
                <SourceChangeNotices sourceId={source.id} />
              </Suspense>
            </AdminDetailColumns>
          </>
        ) : null}

        {tab === "text" ? <SourceText source={source} /> : null}
        {tab === "details" ? <SourceDetails source={source} /> : null}
      </AdminDetailBody>
    </>
  );
}

function SourceDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton actions="buttons" parents={SOURCE_PARENTS} />

      <AdminDetailBody>
        <div className={STAT_TILES_CLASS}>
          {Array.from({ length: 4 }, (_, index) => (
            <StatTileSkeleton key={index} />
          ))}
        </div>
        <AdminSectionSkeleton />
      </AdminDetailBody>
    </>
  );
}
