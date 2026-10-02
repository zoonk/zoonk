import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { type AdminPublicSource } from "@/data/sources/get-source";
import { formatDateTime } from "@/lib/format";
import { FreshnessCommandForm } from "../freshness-command-form";

/**
 * Everything admins check on a public source: where it came from, when it was
 * read and when it is read again, and what was extracted from it.
 */
export function SourcePublicDetails({ source }: { source: AdminPublicSource }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{source.title}</h2>
        {source.publisher ? (
          <p className="text-muted-foreground text-sm">{source.publisher}</p>
        ) : null}
      </div>

      <AdminSection
        action={
          source.url ? <FreshnessCommandForm targetId={source.id} targetKind="source" /> : null
        }
        title="Source"
      >
        <dl className="divide-y">
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
          <DetailField label="Kind">
            <span className="capitalize">{source.kind}</span>
          </DetailField>
          <DetailField label="Language">
            <span className="uppercase">{source.language}</span>
          </DetailField>
          <DetailField label="MIME type">{source.mimeType ?? "—"}</DetailField>
          <DetailField label="Fetched">{formatDateTime(source.fetchedAt)}</DetailField>
          <DetailField label="Valid until">{formatDateTime(source.validUntil)}</DetailField>
          <DetailField label="Next check">{formatDateTime(source.nextCheckAt)}</DetailField>
          <DetailField label="Content hash">
            <span className="font-mono text-xs break-all">{source.contentHash}</span>
          </DetailField>
          <DetailField label="Learners">{source._count.learnerSources}</DetailField>
        </dl>
      </AdminSection>

      <AdminSection title="Extracted content">
        <div className="flex flex-col gap-3">
          <AdminJson label="Reuse policy" value={source.reusePolicy} />
          <AdminJson label="Structure" value={source.structure} />
          <SourceExcerpt excerpt={source.excerpt} textLength={source.textLength} />
        </div>
      </AdminSection>
    </div>
  );
}

function SourceExcerpt({ excerpt, textLength }: { excerpt: string | null; textLength: number }) {
  if (!excerpt) {
    return <p className="text-muted-foreground text-xs">No extracted text.</p>;
  }

  return (
    <details className="text-xs">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer select-none">
        Extracted text ({textLength.toLocaleString()} characters
        {textLength > excerpt.length ? `, first ${excerpt.length.toLocaleString()} shown` : ""})
      </summary>
      <p className="bg-muted/50 mt-2 max-h-96 overflow-auto rounded-lg p-3 whitespace-pre-wrap">
        {excerpt}
      </p>
    </details>
  );
}
