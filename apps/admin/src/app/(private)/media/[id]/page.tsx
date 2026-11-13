import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { AdminRecordTabs, readAdminTab } from "@/components/admin-tabs";
import { type AdminMediaAsset, getMedia } from "@/data/media/get-media";
import { formatDate } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatMediaUsage } from "../_utils/media-format";
import { MediaPreview } from "../media-preview";
import { MediaDetails, MediaPrompt, MediaWrittenBy } from "./media-overview";
import { MediaUsage } from "./media-usage";

/** A picture has no name of its own: it is named by the first lesson that shows it. */
function mediaTitle(asset: AdminMediaAsset): string {
  const noun = asset.kind === "audio" ? "Clip" : "Picture";
  const lesson = asset.steps[0]?.lesson.title;

  return lesson ? `${noun} in ${lesson}` : `${noun} not in a lesson`;
}

export async function generateMetadata({ params }: PageProps<"/media/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getMedia(id);

  if (!record) {
    notFound();
  }

  return { title: mediaTitle(record) };
}

const MEDIA_PARENTS = [{ href: "/media", label: "Media" }];

const MEDIA_TABS = [
  { label: "Overview", value: "overview" },
  { label: "Made by", value: "made" },
  { label: "Details", value: "details" },
] as const;

export default function MediaDetailPage({ params, searchParams }: PageProps<"/media/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<MediaDetailSkeleton />}>
        <MediaDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function MediaDetailContent({ params, searchParams }: PageProps<"/media/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (!isUuid(id)) {
    notFound();
  }

  const asset = await getMedia(id);

  if (!asset) {
    notFound();
  }

  const tab = readAdminTab({ tabs: MEDIA_TABS, value: query.tab });

  return (
    <>
      <AdminDetailHeader
        facts={[
          asset.kind === "audio" ? "Audio" : "Picture",
          asset.language ? languageName(asset.language) : "Any language",
          formatMediaUsage(asset._count.steps),
          `Made ${formatDate(asset.createdAt)}`,
        ]}
        parents={MEDIA_PARENTS}
        title={mediaTitle(asset)}
      />

      <AdminDetailBody>
        <AdminRecordTabs
          current={tab}
          label="Media"
          path={`/media/${asset.id}`}
          tabs={MEDIA_TABS}
        />

        {tab === "overview" ? (
          <AdminDetailColumns aside={<MediaUsage asset={asset} />}>
            {/* Its own box, so the column doesn't stretch the picture to its width. */}
            <div>
              <MediaPreview asset={asset} size="full" />
            </div>
          </AdminDetailColumns>
        ) : null}

        {tab === "made" ? (
          <AdminDetailColumns aside={<MediaWrittenBy asset={asset} />}>
            <MediaPrompt asset={asset} />
          </AdminDetailColumns>
        ) : null}

        {tab === "details" ? <MediaDetails asset={asset} /> : null}
      </AdminDetailBody>
    </>
  );
}

function MediaDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={MEDIA_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton>
          <Skeleton className="aspect-4/5 w-full max-w-sm rounded-xl" />
        </AdminSectionSkeleton>
      </AdminDetailBody>
    </>
  );
}
