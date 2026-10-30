import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type AdminMediaAsset } from "@/data/media/get-media";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { formatMediaSize } from "../_utils/media-format";
import { MediaPreview } from "../media-preview";

export function MediaOverview({ asset }: { asset: AdminMediaAsset }) {
  return (
    <>
      <AdminSection title="Preview">
        <MediaPreview asset={asset} size="full" />
      </AdminSection>

      <AdminSection title="Details">
        <DetailFields>
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
          <DetailField label="Created">{formatDateTime(asset.createdAt)}</DetailField>
        </DetailFields>
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
    </>
  );
}
