import { cn } from "@zoonk/ui/lib/utils";
import { ItemStem, QUESTION_TEXT_CLASS } from "../../questions/item-text";

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
