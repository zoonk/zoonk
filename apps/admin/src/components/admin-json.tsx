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
    <details className="text-xs" open={open}>
      <summary className="text-muted-foreground hover:text-foreground flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 select-none [&::-webkit-details-marker]:hidden">
        {label}
        <FoldChevron inline className="size-3.5" />
      </summary>
      {children}
    </details>
  );
}

export function AdminJson({
  label,
  open,
  value,
}: {
  label: string;
  open?: boolean;
  value: unknown;
}) {
  if (value === null || value === undefined) {
    return (
      <p className="text-muted-foreground flex min-h-11 items-center text-xs">{label}: none</p>
    );
  }

  return (
    <AdminDisclosure label={label} open={open}>
      <pre className="bg-muted/50 mb-2 max-h-96 overflow-auto rounded-lg p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
        {JSON.stringify(value, null, JSON_INDENT)}
      </pre>
    </AdminDisclosure>
  );
}
