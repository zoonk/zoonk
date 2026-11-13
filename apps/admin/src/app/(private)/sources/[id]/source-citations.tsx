import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { getSource } from "@/data/sources/get-source";
import {
  MAX_SOURCE_CITATION_ROWS,
  listSourceCitations,
} from "@/data/sources/list-source-citations";
import { countryName } from "@/lib/country-name";
import { formatCount } from "@/lib/format";
import { ITEM_FORMAT_LABELS } from "@/lib/item-label";
import { languageName } from "@/lib/language-filter";
import { TableCell } from "@zoonk/ui/components/table";

type SourceCitationRows = Awaited<ReturnType<typeof listSourceCitations>>;

const EXAM_COLUMNS: AdminTableColumn[] = [
  { label: "Exam" },
  { label: "Country" },
  { label: "Language" },
];

const ITEM_COLUMNS: AdminTableColumn[] = [
  { label: "Where it cites", twoLines: true },
  { label: "Format", size: "wide" },
  { label: "Language" },
];

export async function SourceCitations({ sourceId }: { sourceId: string }) {
  "use cache: private";

  const [source, { examBlueprints, items }] = await Promise.all([
    getSource(sourceId),
    listSourceCitations(sourceId),
  ]);

  if (source?.visibility !== "public") {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <AdminSection
        title={
          examBlueprints.length > 0
            ? `Read by ${formatCount(examBlueprints.length, "exam")}`
            : "Exams"
        }
      >
        <SourceExamsTable exams={examBlueprints} />
      </AdminSection>

      <AdminSection
        description={
          source._count.items > MAX_SOURCE_CITATION_ROWS
            ? `Showing the latest ${MAX_SOURCE_CITATION_ROWS}.`
            : undefined
        }
        title={
          source._count.items > 0
            ? `Cited by ${formatCount(source._count.items, "practice question")}`
            : "Practice questions"
        }
      >
        <SourceItemsTable items={items} />
      </AdminSection>
    </div>
  );
}

function SourceExamsTable({ exams }: { exams: SourceCitationRows["examBlueprints"] }) {
  return (
    <AdminTableColumns
      columns={EXAM_COLUMNS}
      emptyLabel="No exam was read from this source."
      isEmpty={exams.length === 0}
    >
      {exams.map((exam) => (
        <AdminTableRow key={exam.id}>
          <AdminNameCell href={`/exams/${exam.id}`} title={exam.name} />
          <TableCell>{countryName(exam.country)}</TableCell>
          <TableCell>{languageName(exam.language)}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}

function SourceItemsTable({ items }: { items: SourceCitationRows["items"] }) {
  return (
    <AdminTableColumns
      columns={ITEM_COLUMNS}
      emptyLabel="No practice question cites this source."
      isEmpty={items.length === 0}
    >
      {items.map((item) => (
        <AdminTableRow key={item.id}>
          <AdminNameCell
            href={`/items/${item.id}`}
            note={item.skill.name}
            title={item.sourceCitation ?? "No passage named"}
          />
          <TableCell>{ITEM_FORMAT_LABELS[item.format]}</TableCell>
          <TableCell>{languageName(item.language)}</TableCell>
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}
