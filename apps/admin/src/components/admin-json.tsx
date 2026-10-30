import { ChevronRightIcon } from "lucide-react";

const JSON_INDENT = 2;

export function AdminDisclosure({
  children,
  label,
}: {
  children: React.ReactNode;
  label: React.ReactNode;
}) {
  return (
    <details className="group text-xs">
      <summary className="text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer list-none items-center gap-1.5 select-none [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        {label}
      </summary>
      {children}
    </details>
  );
}

export function AdminJson({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <p className="text-muted-foreground flex min-h-11 items-center text-xs">{label}: none</p>
    );
  }

  return (
    <AdminDisclosure label={label}>
      <pre className="bg-muted/50 mb-2 max-h-96 overflow-auto rounded-lg p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
        {JSON.stringify(value, null, JSON_INDENT)}
      </pre>
    </AdminDisclosure>
  );
}
