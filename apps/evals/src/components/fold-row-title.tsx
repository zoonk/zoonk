/** A fold row's title, with its value on the row's end edge in mono so values line up down the list. */
export function FoldRowTitle({ children, title }: React.PropsWithChildren<{ title: string }>) {
  return (
    <span className="flex min-w-0 flex-1 items-baseline justify-between gap-6">
      <span className="min-w-0 wrap-break-word">{title}</span>
      <span className="text-compact shrink-0 font-mono">{children}</span>
    </span>
  );
}
