import { AdminDisclosure, AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { type AdminPublicSource } from "@/data/sources/get-source";
import { formatDateTime } from "@/lib/format";

export function SourcePublicDetails({ source }: { source: AdminPublicSource }) {
  return (
    <>
      <AdminSection title="Details">
        <DetailFields>
          <DetailField label="URL">
            {source.url ? (
              <a
                className="break-all hover:underline"
                href={source.url}
                rel="noreferrer"
                target="_blank"
              >
                {source.url}
              </a>
            ) : (
              "—"
            )}
          </DetailField>
          <DetailField label="MIME type">{source.mimeType ?? "—"}</DetailField>
          <DetailField label="Fetched">{formatDateTime(source.fetchedAt)}</DetailField>
          <DetailField label="Valid until">{formatDateTime(source.validUntil)}</DetailField>
          <DetailField label="Next check">{formatDateTime(source.nextCheckAt)}</DetailField>
          <DetailField label="Content hash">
            <span className="font-mono text-xs break-all">{source.contentHash}</span>
          </DetailField>
          <DetailField label="Learners">{source._count.learnerSources}</DetailField>
        </DetailFields>
      </AdminSection>

      <AdminSection title="Extracted content">
        <div className="flex flex-col">
          <AdminJson label="Reuse policy" value={source.reusePolicy} />
          <AdminJson label="Structure" value={source.structure} />
          <SourceExcerpt excerpt={source.excerpt} textLength={source.textLength} />
        </div>
      </AdminSection>
    </>
  );
}

function SourceExcerpt({ excerpt, textLength }: { excerpt: string | null; textLength: number }) {
  if (!excerpt) {
    return (
      <p className="text-muted-foreground flex min-h-11 items-center text-xs">No extracted text.</p>
    );
  }

  return (
    <AdminDisclosure
      label={`Extracted text (${textLength.toLocaleString()} characters${
        textLength > excerpt.length ? `, first ${excerpt.length.toLocaleString()} shown` : ""
      })`}
    >
      <p className="bg-muted/50 mb-2 max-h-96 overflow-auto rounded-lg p-3 whitespace-pre-wrap">
        {excerpt}
      </p>
    </AdminDisclosure>
  );
}
