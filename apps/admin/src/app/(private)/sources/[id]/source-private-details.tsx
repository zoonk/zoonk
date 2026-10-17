import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { type AdminPrivateSource } from "@/data/sources/get-source";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";

/** A private upload's metadata only: its title, text and file are personal data. */
export function SourcePrivateDetails({ source }: { source: AdminPrivateSource }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Private upload</h2>
      <p className="text-muted-foreground text-sm">
        This file belongs to one learner. Its contents are personal data and aren&apos;t shown.
      </p>

      <AdminSection title="Upload">
        <dl className="divide-y">
          <DetailField label="Owner">
            {source.owner ? (
              <Link className="hover:underline" href={`/users/${source.owner.id}`} prefetch>
                {source.owner.name || source.owner.email}
              </Link>
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
          <DetailField label="Uploaded">{formatDateTime(source.fetchedAt)}</DetailField>
          <DetailField label="Updated">{formatDateTime(source.updatedAt)}</DetailField>
          <DetailField label="Learners">{source._count.learnerSources}</DetailField>
          <DetailField label="Exams read from it">{source._count.examBlueprints}</DetailField>
          <DetailField label="Items citing it">{source._count.items}</DetailField>
        </dl>
      </AdminSection>
    </div>
  );
}
