import { LessonRichText } from "./lesson-rich-text";

/** The summary card's ideas, numbered, one sentence each: at the end of a lesson or from its menu. */
export function LessonSummaryIdeas({ ideas }: { ideas: string[] }) {
  return (
    <ol className="divide-border border-border flex w-full flex-col divide-y rounded-2xl border">
      {ideas.map((idea, index) => {
        const key = `idea-${index}`;

        return (
          <li className="flex gap-3 p-4 text-base leading-relaxed sm:text-lg" key={key}>
            <span
              aria-hidden="true"
              className="text-muted-foreground w-5 shrink-0 font-semibold tabular-nums"
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <LessonRichText text={idea} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
