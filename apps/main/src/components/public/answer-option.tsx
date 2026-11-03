import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { LessonRichText } from "@zoonk/player/lesson/rich-text";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";

export const ANSWER_OPTION_CLASS =
  "ring-input rounded-option flex min-h-12 w-full items-center gap-3 px-3.5 py-3 text-left text-[15px] leading-snug font-medium ring-1 ring-inset";

/** Chromium leaves MathML out of a button's name, so the option's words name it instead. */
export function AnswerOptionContent({ number, text }: { number: number; text: string }) {
  const spoken = useSpokenText();

  return (
    <>
      <ShortcutKbd className="flex-none">{number}</ShortcutKbd>
      <span aria-hidden="true" className="min-w-0 text-pretty">
        <LessonRichText text={text} />
      </span>
      <span className="sr-only">{spoken.inline(text)}</span>
    </>
  );
}
