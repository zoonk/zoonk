import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { VoteTotalsLabel } from "@/components/vote-totals";
import { getVoteTotals, readVoteTotals } from "@/data/feedback/get-vote-totals";
import { getMedia } from "@/data/media/get-media";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMediaSize } from "../_utils/media-format";
import { MediaPreview } from "../media-preview";

/** The asset itself, how it was made (prompt, scene, palette, style) and how learners voted. */
export async function MediaOverview({ mediaAssetId }: { mediaAssetId: string }) {
  "use cache: private";

  const [asset, voteTotals] = await Promise.all([
    getMedia(mediaAssetId),
    getVoteTotals({ contentIds: [mediaAssetId], contentKind: "mediaAsset" }),
  ]);

  if (!asset) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-sm font-semibold break-all">{asset.reuseKey}</h2>
        <MediaPreview asset={asset} size="full" />
      </div>

      <AdminSection title="Asset">
        <dl className="divide-y">
          <DetailField label="URL">
            <a
              className="break-all hover:underline"
              href={asset.url}
              rel="noreferrer"
              target="_blank"
            >
              {asset.url}
            </a>
          </DetailField>
          <DetailField label="Kind">
            <span className="capitalize">{asset.kind}</span>
          </DetailField>
          <DetailField label="MIME type">{asset.mimeType ?? "—"}</DetailField>
          <DetailField label="Language">
            <span className="uppercase">{asset.language ?? "Any"}</span>
          </DetailField>
          <DetailField label="Style version">{asset.styleVersion ?? "—"}</DetailField>
          <DetailField label="Palette">{asset.palette ?? "—"}</DetailField>
          <DetailField label="Size">{formatMediaSize(asset)}</DetailField>
          <DetailField label="Visibility">
            <span className="capitalize">{asset.visibility}</span>
          </DetailField>
          <DetailField label="Owner">
            {asset.owner ? (
              <Link className="hover:underline" href={`/users/${asset.owner.id}`} prefetch>
                {asset.owner.name || asset.owner.email}
              </Link>
            ) : (
              "—"
            )}
          </DetailField>
          <DetailField label="Votes">
            <VoteTotalsLabel totals={readVoteTotals(voteTotals, asset.id)} />
          </DetailField>
          <DetailField label="Created">{formatDateTime(asset.createdAt)}</DetailField>
        </dl>
      </AdminSection>

      <AdminSection title="Prompt">
        <div className="flex flex-col gap-3">
          <p className="text-sm whitespace-pre-wrap">{asset.prompt ?? "—"}</p>
          <AdminJson label="Scene" value={asset.scene} />
        </div>
      </AdminSection>

      <AdminSection title="Provenance">
        <ProvenanceFields provenance={asset} />
      </AdminSection>
    </div>
  );
}
