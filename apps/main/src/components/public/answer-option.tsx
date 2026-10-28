import { ShortcutKbd } from "@zoonk/ui/components/kbd";

export const ANSWER_OPTION_CLASS =
  "ring-input rounded-option flex min-h-12 w-full items-center gap-3 px-3.5 py-3 text-left text-[15px] leading-snug font-medium ring-1 ring-inset";

export function AnswerOptionContent({ number, text }: { number: number; text: string }) {
  return (
    <>
      <ShortcutKbd className="flex-none">{number}</ShortcutKbd>
      <span className="min-w-0 text-pretty">{text}</span>
    </>
  );
}
