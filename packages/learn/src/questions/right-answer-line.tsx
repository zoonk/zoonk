import { useExtracted } from "next-intl";
import { FeedbackExplanation } from "../_components/feedback-panel";

/** One message around the answer, so each language owns the label's spacing and word order. */
export function RightAnswerLine({ answer }: { answer: React.ReactNode }) {
  const t = useExtracted();

  return (
    <FeedbackExplanation>
      {t.rich("<label>Right answer:</label> <answer></answer>", {
        answer: () => answer,
        label: (words) => words,
      })}
    </FeedbackExplanation>
  );
}
