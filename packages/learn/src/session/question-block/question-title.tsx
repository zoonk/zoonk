import { cn } from "@zoonk/ui/lib/utils";
import { ItemStem, QUESTION_TEXT_CLASS } from "../../questions/item-text";

/**
 * The question itself, set the same in every session block and mistake practice (19px, 560,
 * tight): the loudest line on the screen while the learner answers. Once graded it steps back
 * (`muted`), so the eye goes to the options and the feedback under it.
 */
export function QuestionTitle({
  className,
  muted = false,
  text,
}: {
  className?: string;
  muted?: boolean;
  text: string;
}) {
  return (
    <div className={cn(QUESTION_TEXT_CLASS, muted && "text-muted-foreground", className)}>
      <ItemStem text={text} heading="h2" />
    </div>
  );
}
