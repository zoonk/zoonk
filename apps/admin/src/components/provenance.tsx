import { formatDateTime } from "@/lib/format";
import { DetailField, DetailFields } from "./detail-field";

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
  const ids = [
    { label: "Model", value: provenance.model },
    { label: "Prompt version", value: provenance.promptVersion },
    { label: "Run", value: provenance.runId },
  ];

  return (
    <DetailFields>
      {ids.map((field) => (
        <DetailField key={field.label} label={field.label}>
          {field.value ? <span className="font-mono text-xs break-all">{field.value}</span> : "—"}
        </DetailField>
      ))}
      <DetailField label="Generated">{formatDateTime(provenance.generatedAt)}</DetailField>
    </DetailFields>
  );
}
