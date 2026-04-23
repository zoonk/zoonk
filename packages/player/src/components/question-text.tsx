import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";

export function ContextText({ children }: { children: React.ReactNode }) {
  const content = typeof children === "string" ? stripWrappingQuotes(children) : children;

  return <p className="text-lg leading-relaxed sm:text-xl sm:leading-relaxed">{content}</p>;
}

export function QuestionText({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground text-lg font-semibold tracking-tight sm:text-xl">
      {children}
    </h2>
  );
}
