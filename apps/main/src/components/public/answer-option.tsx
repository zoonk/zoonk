import { ShortcutKbd } from "@zoonk/ui/components/kbd";

/**
 * An answer to a lesson's first question, drawn like the player's options: the strong line, the
 * option radius and its number as a key hint, shown only where there's a keyboard.
 */
export const ANSWER_OPTION_CLASS =
  "ring-input rounded-option flex min-h-12 w-full items-center gap-3 px-3.5 py-3 text-left text-[15px] leading-snug font-medium ring-1 ring-inset";

/** An option's number and text as the player shows them, so a public page shows the lesson as it is. */
export function AnswerOptionContent({ number, text }: { number: number; text: string }) {
  return (
    <>
      <ShortcutKbd className="flex-none">{number}</ShortcutKbd>
      <span className="min-w-0 text-pretty">{text}</span>
    </>
  );
}
