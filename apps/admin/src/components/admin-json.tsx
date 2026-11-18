import { FoldChevron } from "@zoonk/ui/components/collapsible";

const JSON_INDENT = 2;

export function AdminDisclosure({
  children,
  label,
  open,
}: {
  children: React.ReactNode;
  label: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="group/disclosure text-xs" open={open}>
      <summary className="text-muted-foreground hover:text-foreground flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 select-none [&::-webkit-details-marker]:hidden">
        {label}
        <FoldChevron inline className="size-3.5" />
      </summary>
      {children}
    </details>
  );
}

/** Ids and raw data, closed: "Show technical details", as the lesson page's link says it. */
export function AdminTechnicalDetails({
  children,
  open,
}: {
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <AdminDisclosure
      label={
        <span>
          <span className="group-open/disclosure:hidden">Show</span>
          <span className="hidden group-open/disclosure:inline">Hide</span> technical details
        </span>
      }
      open={open}
    >
      {children}
    </AdminDisclosure>
  );
}

/** A record's raw data. Without a `label` it is the record's technical details. */
export function AdminJson({
  label,
  open,
  value,
}: {
  label?: string;
  open?: boolean;
  value: unknown;
}) {
  if (value === null || value === undefined) {
    return label ? (
      <p className="text-muted-foreground flex min-h-11 items-center text-xs">{label}: none</p>
    ) : null;
  }

  const json = (
    <pre className="bg-muted/50 mb-2 max-h-96 overflow-auto rounded-lg p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
      {JSON.stringify(value, null, JSON_INDENT)}
    </pre>
  );

  return label ? (
    <AdminDisclosure label={label} open={open}>
      {json}
    </AdminDisclosure>
  ) : (
    <AdminTechnicalDetails open={open}>{json}</AdminTechnicalDetails>
  );
}
