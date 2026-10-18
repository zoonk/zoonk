import { AdminSection } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { getSource } from "@/data/sources/get-source";
import {
  MAX_SOURCE_CITATION_ROWS,
  listSourceCitations,
} from "@/data/sources/list-source-citations";
import { ITEM_FORMAT_LABELS } from "@/lib/item-label";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

type SourceCitationRows = Awaited<ReturnType<typeof listSourceCitations>>;

const EXAM_COLUMNS: AdminTableColumn[] = [
  { label: "Exam" },
  { label: "Country" },
  { label: "Language" },
];

const ITEM_COLUMNS: AdminTableColumn[] = [
  { label: "Citation" },
  { label: "Skill" },
  { label: "Format" },
  { label: "Language" },
];

/**
 * The exam blueprints read from this source and the items that cite it. A
 * private upload shows only counts, in its metadata.
 */
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
      <AdminSection title={`Exam blueprints (${examBlueprints.length})`}>
        <SourceExamsTable exams={examBlueprints} />
      </AdminSection>

      <AdminSection
        description={
          source._count.items > MAX_SOURCE_CITATION_ROWS
            ? `Showing the latest ${MAX_SOURCE_CITATION_ROWS}.`
            : undefined
        }
        title={`Items citing this source (${source._count.items})`}
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
      emptyLabel="No exam blueprint was read from this source."
      isEmpty={exams.length === 0}
    >
      {exams.map((exam) => (
        <TableRow key={exam.id}>
          <TableCell>
            <Link className="font-medium hover:underline" href={`/exams/${exam.id}`} prefetch>
              {exam.name}
            </Link>
          </TableCell>
          <TableCell>{exam.country}</TableCell>
          <TableCell className="uppercase">{exam.language}</TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}

function SourceItemsTable({ items }: { items: SourceCitationRows["items"] }) {
  return (
    <AdminTableColumns
      columns={ITEM_COLUMNS}
      emptyLabel="No item cites this source."
      isEmpty={items.length === 0}
    >
      {items.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="max-w-96 min-w-56 whitespace-normal">
            <Link className="hover:underline" href={`/items/${item.id}`} prefetch={false}>
              {item.sourceCitation ?? "No citation"}
            </Link>
          </TableCell>
          <TableCell className="max-w-64 whitespace-normal">{item.skill.name}</TableCell>
          <TableCell>{ITEM_FORMAT_LABELS[item.format]}</TableCell>
          <TableCell className="uppercase">{item.language}</TableCell>
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}
