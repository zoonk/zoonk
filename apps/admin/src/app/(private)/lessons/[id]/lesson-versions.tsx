import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { AdminTableRow } from "@/components/admin-table-row";
import { type LibraryLessonStep } from "@/data/lessons/get-library-lesson";
import { Table, TableBody, TableCell, TableHead, TableHeader } from "@zoonk/ui/components/table";

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
        <Table>
          <TableHeader>
            <AdminTableRow>
              <TableHead>Written</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Prompt version</TableHead>
              <TableHead numeric>Step contract</TableHead>
              <TableHead numeric>Rows</TableHead>
            </AdminTableRow>
          </TableHeader>
          <TableBody>
            {versions.map((version) => (
              <AdminTableRow key={versionKey(version)}>
                <TableCell>
                  {version.kind === "screen" ? "Screens" : "Versions of screens"}
                </TableCell>
                <TableCell className="font-mono text-xs">{version.model}</TableCell>
                <TableCell className="font-mono text-xs">{version.promptVersion}</TableCell>
                <TableCell numeric>v{version.contractVersion}</TableCell>
                <TableCell numeric>{version.rows}</TableCell>
              </AdminTableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AdminSection>
  );
}
