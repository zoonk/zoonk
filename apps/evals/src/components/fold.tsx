import { FoldChevron } from "@zoonk/ui/components/collapsible";

export function Fold({
  children,
  className,
  isOpen,
  title,
}: React.PropsWithChildren<{ className?: string; isOpen?: boolean; title: string }>) {
  return (
    <details className={className} open={isOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <FoldChevron className="text-muted-foreground" inline />
      </summary>

      {children}
    </details>
  );
}
