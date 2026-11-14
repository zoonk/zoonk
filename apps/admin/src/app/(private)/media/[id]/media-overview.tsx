import { AdminJson } from "@/components/admin-json";
import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type AdminMediaAsset } from "@/data/media/get-media";
import { formatDateTime } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { LINK_CLASS } from "@/lib/link-class";
import Link from "next/link";
import { formatMediaSize } from "../_utils/media-format";

/** What the picture or clip was asked to be. */
export function MediaPrompt({ asset }: { asset: AdminMediaAsset }) {
  return (
    <AdminSection title="What it was asked to show">
      {asset.prompt ? (
        <p className="max-w-2xl text-sm leading-6 whitespace-pre-wrap">{asset.prompt}</p>
      ) : (
        <AdminSectionEmpty>No prompt was kept for it.</AdminSectionEmpty>
      )}
      <AdminJson label="Scene" value={asset.scene} />
    </AdminSection>
  );
}

export function MediaWrittenBy({ asset }: { asset: AdminMediaAsset }) {
  return (
    <AdminSection title="Made by">
      <ProvenanceFields provenance={asset} />
    </AdminSection>
  );
}

export function MediaDetails({ asset }: { asset: AdminMediaAsset }) {
  return (
    <AdminSection title="Details">
      <DetailFields>
        <DetailField label="Reuse key">{asset.reuseKey}</DetailField>
        <DetailField label="File">
          <a
            className={`${LINK_CLASS} break-all`}
            href={asset.url}
            rel="noreferrer"
            target="_blank"
          >
            {asset.url}
          </a>
        </DetailField>
        <DetailField label="File type">{asset.mimeType}</DetailField>
        <DetailField label="Language">
          {asset.language ? languageName(asset.language) : "Any language"}
        </DetailField>
        <DetailField label="Size">{formatMediaSize(asset)}</DetailField>
        <DetailField label="Style version">{asset.styleVersion}</DetailField>
        <DetailField label="Palette">{asset.palette}</DetailField>
        <DetailField label="Open to">
          {asset.owner ? (
            <Link className={LINK_CLASS} href={`/users/${asset.owner.id}`} prefetch>
              Only {asset.owner.name || asset.owner.email}
            </Link>
          ) : (
            "Everyone"
          )}
        </DetailField>
        <DetailField label="Created" mono={false}>
          {formatDateTime(asset.createdAt)}
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}
