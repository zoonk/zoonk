import { LessonRichText } from "./lesson-rich-text";

export function LessonSummaryIdeas({ ideas }: { ideas: string[] }) {
  return (
    <ol className="divided-rows flex w-full flex-col">
      {ideas.map((idea, index) => {
        const key = `idea-${index}`;

        return (
          <li
            className="border-border flex gap-3 py-3 text-base leading-relaxed sm:text-lg"
            key={key}
          >
            <span aria-hidden="true" className="text-faint w-5 shrink-0 font-mono tabular-nums">
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
