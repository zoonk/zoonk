import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminTableRow } from "@/components/admin-table-row";
import { SourceKindIcon } from "@/components/source-kind-icon";
import { type ListedSource } from "@/data/sources/list-sources";
import { capitalize, formatCount, formatDate } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { TableCell } from "@zoonk/ui/components/table";

/** What reads from the source, exams first: "2 exams · 14 learners". */
function usedBy({ examBlueprints, learnerSources }: ListedSource["_count"]): string {
  return [
    examBlueprints > 0 ? formatCount(examBlueprints, "exam") : null,
    learnerSources > 0 ? formatCount(learnerSources, "learner") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Private uploads show a fixed label: their title is dropped before it reaches this row. */
export function SourceRow({ source }: { source: ListedSource }) {
  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/sources/${source.id}`}
        icon={<SourceKindIcon kind={source.kind} />}
        note={[source.title ? source.publisher : null, languageName(source.language)]
          .filter(Boolean)
          .join(" · ")}
        title={source.title ?? "Private upload"}
      />
      <TableCell>{capitalize(source.kind)}</TableCell>
      <TableCell>{formatDate(source.fetchedAt)}</TableCell>
      <TableCell>{source.validUntil ? formatDate(source.validUntil) : "No end date"}</TableCell>
      <TableCell>{usedBy(source._count) || "—"}</TableCell>
    </AdminTableRow>
  );
}
