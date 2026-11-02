import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type AdminItem } from "@/data/items/get-item";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";

const CALIBRATION_DIGITS = 2;

function formatCalibration(value: number | null): string {
  return value === null ? "—" : value.toFixed(CALIBRATION_DIGITS);
}

export function ItemOverview({ item }: { item: AdminItem }) {
  return (
    <>
      <AdminSection title="Details">
        <DetailFields>
          <DetailField label="Skill">
            <Link className="hover:underline" href={`/skills/${item.skill.id}`} prefetch>
              {item.skill.name}
            </Link>
          </DetailField>
          <DetailField label="Field">{item.field ?? "General"}</DetailField>
          <DetailField label="Exam">
            {item.examBlueprint ? (
              <Link className="hover:underline" href={`/exams/${item.examBlueprint.id}`} prefetch>
                {item.examBlueprint.name}
              </Link>
            ) : (
              "—"
            )}
          </DetailField>
          <DetailField label="Source">
            <ItemSource item={item} />
          </DetailField>
          <DetailField label="Difficulty">{formatCalibration(item.difficulty)}</DetailField>
          <DetailField label="Discrimination">{formatCalibration(item.discrimination)}</DetailField>
          <DetailField label="Created">{formatDateTime(item.createdAt)}</DetailField>
          <DetailField label="Updated">{formatDateTime(item.updatedAt)}</DetailField>
        </DetailFields>
        <AdminJson label="Content" value={item.content} />
      </AdminSection>

      <AdminSection title="Provenance">
        <ProvenanceFields provenance={item} />
      </AdminSection>
    </>
  );
}

/** A private upload's title and citation can be personal data, so only its link is shown. */
function ItemSource({ item }: { item: AdminItem }) {
  if (!item.source) {
    return item.sourceCitation ?? "—";
  }

  return (
    <span className="flex flex-col gap-0.5">
      <Link className="hover:underline" href={`/sources/${item.source.id}`} prefetch>
        {item.source.title ?? "Private upload"}
      </Link>
      {item.source.title && item.sourceCitation ? (
        <span className="text-muted-foreground text-xs">{item.sourceCitation}</span>
      ) : null}
    </span>
  );
}
