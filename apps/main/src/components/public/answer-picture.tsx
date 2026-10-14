import {
  ANSWER_OPTION_CLASS,
  ANSWER_TAG_CLASS,
  ANSWER_TAG_TONE,
  ANSWER_TONE,
  type AnswerOptionResult,
} from "@zoonk/learn/answer-tone";
import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";

/**
 * An answer as the player draws it, on a public page's picture of a question: its key in a keycap,
 * its words, a firm ring when picked, green or red once checked with its word on the right
 * ("Correct", "Your answer"). Nothing to press: the question is an example.
 */
export function AnswerPicture({
  children,
  lang,
  marker,
  picked = false,
  result,
  tag,
}: {
  children: ReactNode;
  /** The answer's language when it isn't the page's (a sentence in the language being learned). */
  lang?: string;
  marker: string;
  picked?: boolean;
  result?: AnswerOptionResult;
  tag?: string;
}) {
  return (
    <li
      className={cn(
        ANSWER_OPTION_CLASS,
        ANSWER_TONE.idle,
        picked && !result && ANSWER_TONE.picked,
        result && ANSWER_TONE[result],
      )}
    >
      <LineMarker aria-hidden="true">
        <Kbd>{marker}</Kbd>
      </LineMarker>

      <span className="min-w-0 flex-1 text-pretty" lang={lang}>
        {children}
      </span>

      {tag && result && (
        <LineMarker>
          <span className={cn(ANSWER_TAG_CLASS, ANSWER_TAG_TONE[result])}>{tag}</span>
        </LineMarker>
      )}
    </li>
  );
}

/** A question's answers, one under the other like an exam's answer sheet. */
export function AnswerPictures({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol className={cn("flex flex-col gap-2", className)} {...props} />;
}
