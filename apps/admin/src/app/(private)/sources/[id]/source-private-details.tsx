import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { type AdminPrivateSource } from "@/data/sources/get-source";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";

/** A private upload's metadata only: its title, text and file are personal data. */
export function SourcePrivateDetails({ source }: { source: AdminPrivateSource }) {
  return (
    <AdminSection
      description="This file belongs to one learner. Its contents are personal data and aren't shown."
      title="Details"
    >
      <DetailFields>
        <DetailField label="Owner">
          {source.owner ? (
            <Link
              className="hit-area relative underline underline-offset-3"
              href={`/users/${source.owner.id}`}
              prefetch
            >
              {source.owner.name || source.owner.email}
            </Link>
          ) : null}
        </DetailField>
        <DetailField label="Uploaded" mono={false}>
          {source.fetchedAt ? formatDateTime(source.fetchedAt) : null}
        </DetailField>
        <DetailField label="Updated" mono={false}>
          {formatDateTime(source.updatedAt)}
        </DetailField>
        <DetailField label="Learners">
          {source._count.learnerSources.toLocaleString("en")}
        </DetailField>
        <DetailField label="Exams read from it">
          {source._count.examBlueprints.toLocaleString("en")}
        </DetailField>
        <DetailField label="Practice questions citing it">
          {source._count.items.toLocaleString("en")}
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}
