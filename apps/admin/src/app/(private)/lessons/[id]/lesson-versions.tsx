import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type LibraryLessonStep } from "@/data/lessons/get-library-lesson";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

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

/** Groups screens and their versions by who wrote them and which step contract they follow. */
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

/**
 * Which models, prompt versions and step contract versions wrote this lesson's screens and their
 * field and tool versions. A lesson partly rewritten shows two rows.
 */
export function LessonVersions({ steps }: { steps: LibraryLessonStep[] }) {
  const versions = groupVersions(steps);

  return (
    <AdminSection title="Versions">
      {versions.length === 0 ? (
        <AdminSectionEmpty>No screens written yet.</AdminSectionEmpty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Written</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Prompt version</TableHead>
                <TableHead className="text-right">Step contract</TableHead>
                <TableHead className="text-right">Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => (
                <TableRow key={versionKey(version)}>
                  <TableCell>
                    {version.kind === "screen" ? "Screens" : "Versions of screens"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{version.model}</TableCell>
                  <TableCell className="font-mono text-xs">{version.promptVersion}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    v{version.contractVersion}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{version.rows}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminSection>
  );
}
