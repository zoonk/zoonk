import { formatDateTime } from "@/lib/format";

const RUN_ID_PREFIX_LENGTH = 8;

type ProvenanceValue = {
  generatedAt?: Date | null;
  model: string | null;
  promptVersion: string | null;
  runId?: string | null;
};

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
