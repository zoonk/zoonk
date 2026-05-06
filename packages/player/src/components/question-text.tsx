import { PlayerRichText } from "./player-rich-text";

export function ContextText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-lg leading-relaxed sm:text-xl sm:leading-relaxed">
      {typeof children === "string" ? <PlayerRichText text={children} /> : children}
    </p>
  );
}

export function QuestionText({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground text-lg font-semibold tracking-tight sm:text-xl">
      {typeof children === "string" ? <PlayerRichText text={children} /> : children}
    </h2>
  );
}
