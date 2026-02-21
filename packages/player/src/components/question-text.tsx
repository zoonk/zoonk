export function ContextText({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-base">{children}</p>;
}

export function QuestionText({ children }: { children: React.ReactNode }) {
  return <p className="text-base font-semibold">{children}</p>;
}
