import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { LightbulbIcon, MicIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ExampleMove, getExampleMove } from "../example-move";
import { renderBold } from "../rich-text";

/** The sentence is practiced in the language of the example move, never in the page's own. */
const TARGET_SENTENCES: Record<ExampleMove, { language: string; text: string }> = {
  london: { language: "en", text: "Can I see the flat on Saturday?" },
  madrid: { language: "es", text: "¿Puedo ver el piso el sábado?" },
};

/** Bar heights of the recording: the spoken part first, then the rest still to say. */
const SPOKEN_BARS = [
  "h-2",
  "h-3.5",
  "h-[22px]",
  "h-[30px]",
  "h-[18px]",
  "h-3",
  "h-6",
  "h-8",
  "h-5",
  "h-2.5",
  "h-4",
  "h-[26px]",
  "h-3.5",
  "h-2",
] as const;

const REMAINING_BARS = ["h-3", "h-5", "h-7", "h-4", "h-2.5", "h-[18px]", "h-2"] as const;

/** Speaking practice for a move: say a real sentence and get a tip on how it sounds. */
export async function LanguagePreview() {
  const [t, move] = await Promise.all([getExtracted(), getExampleMove()]);
  const target = TARGET_SENTENCES[move];

  const bars = [
    ...SPOKEN_BARS.map((height) => ({ height, isSpoken: true })),
    ...REMAINING_BARS.map((height) => ({ height, isSpoken: false })),
  ];

  return (
    <div aria-hidden="true" className={cn(PREVIEW_CARD_CLASS, "mt-5 p-4 sm:mt-6")}>
      <p className="text-muted-foreground text-xs font-medium">{t("Say it out loud")}</p>
      <p className="mt-1 text-base leading-snug font-semibold" lang={target.language}>
        {target.text}
      </p>
      <p className="text-muted-foreground mt-0.5 text-[13px]">
        {t("Can I see the apartment on Saturday?")}
      </p>

      <div className="mt-3 flex items-center gap-3">
        <span className="bg-foreground text-background flex size-10 flex-none items-center justify-center rounded-full">
          <MicIcon className="size-4" />
        </span>
        <div className="flex h-[34px] items-center gap-[3px] overflow-hidden">
          {bars.map((bar, index) => (
            <i
              className={cn(
                "block w-[3px] flex-none rounded-full",
                bar.height,
                bar.isSpoken ? "bg-sky-600 dark:bg-sky-400" : "bg-border",
              )}
              // oxlint-disable-next-line react/no-array-index-key -- The bars never reorder.
              key={index}
            />
          ))}
        </div>
      </div>

      <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] leading-snug dark:bg-amber-950/60">
        <LightbulbIcon className="mt-px size-4 flex-none text-amber-600 dark:text-amber-400" />
        <span>
          {t.rich(
            "{move, select, london {Stress the first part: <b>SAT</b>-ur-day.} other {Stress the accent: <b>SÁ</b>-ba-do.}}",
            { b: renderBold, move },
          )}
        </span>
      </p>
    </div>
  );
}
