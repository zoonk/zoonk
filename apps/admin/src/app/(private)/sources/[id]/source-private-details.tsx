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
            <Link className="hover:underline" href={`/users/${source.owner.id}`} prefetch>
              {source.owner.name || source.owner.email}
            </Link>
          ) : (
            "—"
          )}
        </DetailField>
        <DetailField label="Uploaded">{formatDateTime(source.fetchedAt)}</DetailField>
        <DetailField label="Updated">{formatDateTime(source.updatedAt)}</DetailField>
        <DetailField label="Learners">{source._count.learnerSources}</DetailField>
        <DetailField label="Exams read from it">{source._count.examBlueprints}</DetailField>
        <DetailField label="Items citing it">{source._count.items}</DetailField>
      </DetailFields>
    </AdminSection>
  );
}
