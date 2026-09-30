import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, NotebookPenIcon, TimerIcon, XIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { renderBold } from "../rich-text";

const OPTION_LETTERS = ["A", "B", "C"] as const;

function ExamOption({
  children,
  letter,
  state,
}: {
  children: ReactNode;
  letter: (typeof OPTION_LETTERS)[number];
  state?: "right" | "wrong";
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 items-center gap-2.5 rounded-[11px] px-2.5 py-1.5 text-sm ring-1 ring-inset",
        !state && "ring-border",
        state === "right" && "bg-emerald-50 ring-[1.5px] ring-emerald-600 dark:bg-emerald-950/60",
        state === "wrong" && "bg-pink-50 ring-[1.5px] ring-pink-600 dark:bg-pink-950/60",
      )}
    >
      <span
        className={cn(
          "flex size-[22px] flex-none items-center justify-center rounded-[7px] text-xs font-semibold",
          !state && "bg-muted text-muted-foreground",
          state === "right" && "bg-emerald-600 text-white",
          state === "wrong" && "bg-pink-600 text-white",
        )}
      >
        {letter}
      </span>
      {children}
      {state === "right" && <CheckIcon className="ml-auto size-4 flex-none text-emerald-600" />}
      {state === "wrong" && <XIcon className="ml-auto size-4 flex-none text-pink-600" />}
    </div>
  );
}

function renderEmphasis(chunks: ReactNode) {
  return <b className="text-foreground">{chunks}</b>;
}

/** An exam question in the real format, its explanation, a timed mock and the mistakes notebook. */
export async function ExamPreview() {
  const t = await getExtracted();

  return (
    <div aria-hidden="true" className="mt-5 flex gap-4 sm:mt-6">
      <div className={cn(PREVIEW_CARD_CLASS, "min-w-0 flex-1 p-4 sm:p-5")}>
        <span className="bg-muted text-muted-foreground inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-xs font-medium dark:bg-neutral-700 dark:text-neutral-300">
          {t("SAT style · Math")}
        </span>
        <p className="mt-3 text-[15px] leading-snug">
          {t.rich(
            "A price goes up <b>20%</b>, then down <b>20%</b>. What percent of the original price is it now?",
            { b: renderBold },
          )}
        </p>
        <div className="mt-3.5 flex flex-col gap-2">
          <div className="hidden sm:block">
            <ExamOption letter="A">{t("80%")}</ExamOption>
          </div>
          <ExamOption letter="B" state="right">
            {t("96%")}
          </ExamOption>
          <ExamOption letter="C" state="wrong">
            {t("100%")}
          </ExamOption>
        </div>
        <p className="text-muted-foreground mt-3.5 hidden text-[13px] leading-snug sm:block">
          {t.rich("<b>Not quite. The 20% off comes from the higher price:</b> 1.2 × 0.8 = 0.96.", {
            b: renderEmphasis,
          })}
        </p>
      </div>

      <div className="hidden w-[212px] flex-none flex-col gap-4 md:flex">
        <div className={cn(PREVIEW_CARD_CLASS, "flex-1 p-5")}>
          <span className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <TimerIcon className="size-[18px]" />
          </span>
          <p className="text-muted-foreground mt-4 text-[13px]">{t("Sunday")}</p>
          <p className="mt-0.5 text-base leading-snug font-semibold">
            {t("Mock exam, timed like the real one")}
          </p>
          <p className="text-muted-foreground mt-1.5 text-[13px] leading-snug">
            {t("Full length · 2h 14m")}
          </p>
        </div>

        <div className={cn(PREVIEW_CARD_CLASS, "flex items-start gap-3 p-4")}>
          <span className="flex size-9 flex-none items-center justify-center rounded-full bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-300">
            <NotebookPenIcon className="size-[18px]" />
          </span>
          <div>
            <p className="text-sm leading-tight font-medium">{t("Mistakes notebook")}</p>
            <p className="text-muted-foreground mt-0.5 text-[13px]">
              {t("Back as practice Friday")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
