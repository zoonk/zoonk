import { Kbd } from "@zoonk/ui/components/kbd";

/** An answer to a lesson's first question, drawn like the player's options. */
export const ANSWER_OPTION_CLASS =
  "border-border flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] leading-snug sm:text-base";

/** An option's number and text as the player shows them, so a public page shows the lesson as it is. */
export function AnswerOptionContent({ number, text }: { number: number; text: string }) {
  return (
    <>
      <Kbd aria-hidden="true" className="flex-none">
        {number}
      </Kbd>
      <span className="min-w-0 text-pretty">{text}</span>
    </>
  );
}
