import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { getMedia } from "@/data/media/get-media";
import { capitalize } from "@/lib/format";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MediaOverview } from "./media-overview";
import { MediaUsage } from "./media-usage";

export const metadata: Metadata = { title: "Media asset" };

const MEDIA_PARENTS = [{ href: "/media", label: "Media" }];

export default function MediaDetailPage({ params }: PageProps<"/media/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<MediaDetailSkeleton />}>
        <MediaDetailContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function MediaDetailContent({ params }: Pick<PageProps<"/media/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const asset = await getMedia(id);

  if (!asset) {
    notFound();
  }

  return (
    <>
      <AdminDetailHeader
        facts={[asset.mimeType ?? capitalize(asset.kind)]}
        parents={MEDIA_PARENTS}
        title={asset.reuseKey}
        titleClassName="font-mono text-xl font-semibold break-all"
      />

      <AdminDetailBody>
        <MediaOverview asset={asset} />

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <MediaUsage mediaAssetId={asset.id} />
        </Suspense>
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
          <Skeleton className="h-96 w-72 max-w-full rounded-lg" />
        </AdminSectionSkeleton>
        <AdminSectionSkeleton rows={9} />
      </AdminDetailBody>
    </>
  );
}
