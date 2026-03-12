export function ContextText({ children }: { children: React.ReactNode }) {
  return <p className="text-base">{children}</p>;
}

export function QuestionText({ children }: { children: React.ReactNode }) {
  return <h2 className="text-muted-foreground text-base font-semibold">{children}</h2>;
}
