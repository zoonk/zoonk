export function RomanizationText({ children }: { children?: string | null }) {
  if (!children) {
    return null;
  }

  return <span className="text-muted-foreground text-xs italic">{children}</span>;
}
