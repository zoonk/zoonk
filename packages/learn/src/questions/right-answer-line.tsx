import { useExtracted } from "next-intl";
import { FeedbackExplanation } from "../_components/feedback-panel";
import { ItemLine } from "./item-text";

/** One message around the answer, so each language owns the label's spacing and word order. */
export function RightAnswerLine({ answer }: { answer: string }) {
  const t = useExtracted();
  const line = <ItemLine text={answer} />;

  return (
    <FeedbackExplanation>
      {t.rich("<label>Right answer:</label> <answer></answer>", {
        answer: () => line,
        label: (words) => words,
      })}
    </FeedbackExplanation>
  );
}
