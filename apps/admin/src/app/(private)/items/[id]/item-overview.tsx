import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type AdminItem, getItem } from "@/data/items/get-item";
import { formatDateTime } from "@/lib/format";
import { ITEM_FORMAT_LABELS, getItemLabel } from "@/lib/item-label";
import Link from "next/link";
import { notFound } from "next/navigation";

const CALIBRATION_DIGITS = 2;

function formatCalibration(value: number | null): string {
  return value === null ? "—" : value.toFixed(CALIBRATION_DIGITS);
}

/** The item's question and stored content, where it came from and how it was made. */
export async function ItemOverview({ itemId }: { itemId: string }) {
  "use cache: private";

  const item = await getItem(itemId);

  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{getItemLabel(item)}</h2>
        <AdminJson label="Content" value={item.content} />
      </div>

      <AdminSection title="Item">
        <dl className="divide-y">
          <DetailField label="Skill">
            <Link className="hover:underline" href={`/skills/${item.skill.id}`} prefetch>
              {item.skill.name}
            </Link>
          </DetailField>
          <DetailField label="Format">{ITEM_FORMAT_LABELS[item.format]}</DetailField>
          <DetailField label="Language">
            <span className="uppercase">{item.language}</span>
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
        </dl>
      </AdminSection>

      <AdminSection title="Provenance">
        <ProvenanceFields provenance={item} />
      </AdminSection>
    </div>
  );
}

/**
 * Past exam questions cite the source they were drawn from. A private upload's
 * title and citation can be personal data, so only its link is shown.
 */
function ItemSource({ item }: { item: AdminItem }) {
  if (!item.source) {
    return item.sourceCitation ?? "—";
  }

  return (
    <span className="flex flex-col items-end gap-0.5">
      <Link className="hover:underline" href={`/sources/${item.source.id}`} prefetch>
        {item.source.title ?? "Private upload"}
      </Link>
      {item.source.title && item.sourceCitation ? (
        <span className="text-muted-foreground text-xs">{item.sourceCitation}</span>
      ) : null}
    </span>
  );
}
