const JSON_INDENT = 2;

/**
 * AI content is stored as versioned JSON. Admins read it as formatted JSON in
 * a bounded, scrollable block so a long step never pushes the page apart.
 */
export function AdminJson({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-muted-foreground text-xs">{label}: none</p>;
  }

  return (
    <details className="group text-xs">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer select-none">
        {label}
      </summary>
      <pre className="bg-muted/50 mt-2 max-h-96 overflow-auto rounded-lg p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
        {JSON.stringify(value, null, JSON_INDENT)}
      </pre>
    </details>
  );
}
