import { LessonRichText } from "./lesson-rich-text";
import { NumberedLine } from "./numbered-line";

export function LessonSummaryIdeas({ ideas }: { ideas: string[] }) {
  return (
    <ol className="divided-rows flex w-full flex-col">
      {ideas.map((idea, index) => {
        const key = `idea-${index}`;

        return (
          <NumberedLine className="border-border py-3" key={key} number={index + 1}>
            <span>
              <LessonRichText text={idea} />
            </span>
          </NumberedLine>
        );
      })}
    </ol>
  );
}
