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

export function AnswerPicture({
  children,
  lang,
  marker,
  picked = false,
  result,
  tag,
}: {
  children: ReactNode;
  lang?: string;
  marker: number;
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

export function AnswerPictures({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol className={cn("flex flex-col gap-2", className)} {...props} />;
}
