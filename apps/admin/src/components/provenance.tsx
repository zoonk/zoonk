import { formatDateTime } from "@/lib/format";

/** Enough of a run id to tell runs apart in a table; detail pages show all of it. */
const RUN_ID_PREFIX_LENGTH = 8;

type ProvenanceValue = {
  generatedAt?: Date | null;
  model: string | null;
  promptVersion: string | null;
  runId?: string | null;
};

/**
 * Every AI-written row carries the model, prompt version and run that made it.
 * One compact line keeps that visible in tables without adding four columns.
 */
export function ProvenanceLine({ provenance }: { provenance: ProvenanceValue }) {
  if (!provenance.model) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <span className="flex flex-col gap-0.5 text-xs">
      <span className="font-mono">{provenance.model}</span>
      <span className="text-muted-foreground font-mono">
        {[provenance.promptVersion, provenance.runId?.slice(0, RUN_ID_PREFIX_LENGTH)]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </span>
  );
}

/**
 * Detail pages show the full provenance, including the run id admins paste
 * into workflow logs and the time the row was written.
 */
export function ProvenanceFields({ provenance }: { provenance: ProvenanceValue }) {
  const fields = [
    { label: "Model", value: provenance.model },
    { label: "Prompt version", value: provenance.promptVersion },
    { label: "Run", value: provenance.runId },
    {
      label: "Generated",
      value: provenance.generatedAt ? formatDateTime(provenance.generatedAt) : null,
    },
  ];

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      {fields.map((field) => (
        <div className="contents" key={field.label}>
          <dt className="text-muted-foreground">{field.label}</dt>
          <dd className="font-mono break-all">{field.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
