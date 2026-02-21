export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{children}</p>
  );
}
