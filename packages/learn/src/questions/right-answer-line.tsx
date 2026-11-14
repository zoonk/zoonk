import { useExtracted } from "next-intl";
import {
  FeedbackAnswerLabel,
  FeedbackAnswerValue,
  FeedbackExplanation,
} from "../_components/feedback-panel";

function answerLabel(words: React.ReactNode) {
  return <FeedbackAnswerLabel>{words}</FeedbackAnswerLabel>;
}

/**
 * The right answer after a miss, in every feedback panel. One message around the answer, so each
 * language owns the label's spacing and word order.
 */
export function RightAnswerLine({ answer }: { answer: React.ReactNode }) {
  const t = useExtracted();
  const value = <FeedbackAnswerValue>{answer}</FeedbackAnswerValue>;

  return (
    <FeedbackExplanation>
      {t.rich("<label>Right answer:</label> <answer></answer>", {
        answer: () => value,
        label: answerLabel,
      })}
    </FeedbackExplanation>
  );
}
