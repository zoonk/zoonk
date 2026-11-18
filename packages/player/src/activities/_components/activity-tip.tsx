import { FEEDBACK_MARKER_CLASS } from "@zoonk/learn/feedback-panel";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { LightbulbIcon } from "lucide-react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";

export function ActivityTip({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-sm leading-snug">
      <LineMarker className={FEEDBACK_MARKER_CLASS}>
        <LightbulbIcon aria-hidden="true" className="text-viz-highlight size-4" />
      </LineMarker>
      <LessonRichText text={text} />
    </p>
  );
}
