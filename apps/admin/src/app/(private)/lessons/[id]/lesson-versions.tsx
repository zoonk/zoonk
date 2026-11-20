import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { type LibraryLessonStep } from "@/data/lessons/get-library-lesson";
import { TableCell } from "@zoonk/ui/components/table";

const columns: AdminTableColumn[] = [
  { label: "What" },
  { label: "Model", size: "text" },
  { label: "Prompt version", size: "wide" },
  { align: "right", label: "Screen format", size: "wide" },
  { align: "right", label: "How many" },
];

type VersionRow = {
  contractVersion: number;
  kind: "screen" | "variant";
  model: string;
  promptVersion: string;
  rows: number;
};

type VersionSource = Omit<VersionRow, "rows">;

function toVersionSources(steps: LibraryLessonStep[]): VersionSource[] {
  return steps.flatMap((step) => [
    { ...step, kind: "screen" as const },
    ...step.variants.map((variant) => ({ ...variant, kind: "variant" as const })),
  ]);
}

function versionKey(source: VersionSource): string {
  return [source.kind, source.model, source.promptVersion, source.contractVersion].join("|");
}

function groupVersions(steps: LibraryLessonStep[]): VersionRow[] {
  const groups = Map.groupBy(toVersionSources(steps), versionKey);

  return [...groups.values()].map((sources) => {
    const [first] = sources;

    return {
      contractVersion: first?.contractVersion ?? 0,
      kind: first?.kind ?? "screen",
      model: first?.model ?? "",
      promptVersion: first?.promptVersion ?? "",
      rows: sources.length,
    };
  });
}

export function LessonVersions({ steps }: { steps: LibraryLessonStep[] }) {
  const versions = groupVersions(steps);

  return (
    <AdminSection title="Versions">
      {versions.length === 0 ? (
        <AdminSectionEmpty>No screens written yet.</AdminSectionEmpty>
      ) : (
        <AdminTableColumns columns={columns} emptyLabel="" isEmpty={false}>
          {versions.map((version) => (
            <AdminTableRow key={versionKey(version)}>
              <TableCell className="text-foreground font-medium">
                {version.kind === "screen" ? "Screens" : "Versions of screens"}
              </TableCell>
              <TableCell>{version.model}</TableCell>
              <TableCell className="text-compact font-mono">{version.promptVersion}</TableCell>
              <TableCell numeric>v{version.contractVersion}</TableCell>
              <TableCell numeric>{version.rows}</TableCell>
            </AdminTableRow>
          ))}
        </AdminTableColumns>
      )}
    </AdminSection>
  );
}
