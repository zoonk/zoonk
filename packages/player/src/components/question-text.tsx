import { PlayerRichText } from "./player-rich-text";

export function ContextText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-lg leading-relaxed sm:text-xl sm:leading-relaxed">
      {typeof children === "string" ? <PlayerRichText text={children} /> : children}
    </p>
  );
}

/** The line the learner answers, in the same type as a lesson's other questions. */
export function QuestionText({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-foreground text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">
      {typeof children === "string" ? <PlayerRichText text={children} /> : children}
    </h2>
  );
}
