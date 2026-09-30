import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { NotebookPenIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** Memory with and without reviews, and mistakes coming back as practice. */
export async function MemoryPreview() {
  const t = await getExtracted();

  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className={cn(PREVIEW_CARD_CLASS, "p-4")}>
        <p className="text-[15px] font-semibold">{t("What you remember")}</p>

        <svg className="mt-2 w-full overflow-visible" fill="none" viewBox="0 0 266 132">
          <path className="stroke-border" d="M4 122 H262" strokeWidth="1.5" />
          <path
            className="stroke-muted-foreground"
            d="M4 26 C 30 84, 90 112, 262 118"
            strokeDasharray="3 5"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <path
            className="stroke-foreground"
            d="M4 26 C 20 54, 34 70, 50 76 L50 26 C 78 46, 108 58, 134 62 L134 26 C 176 38, 218 44, 262 46"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
          <circle
            className="fill-foreground stroke-card dark:stroke-neutral-800"
            cx="50"
            cy="26"
            r="5"
            strokeWidth="2"
          />
          <circle
            className="fill-foreground stroke-card dark:stroke-neutral-800"
            cx="134"
            cy="26"
            r="5"
            strokeWidth="2"
          />
          <text className="fill-muted-foreground text-xs" textAnchor="middle" x="50" y="12">
            {t("Review")}
          </text>
          <text className="fill-muted-foreground text-xs" textAnchor="middle" x="134" y="12">
            {t("Review")}
          </text>
          <text className="fill-foreground text-xs font-semibold" textAnchor="end" x="262" y="64">
            {t("With reviews")}
          </text>
          <text className="fill-muted-foreground text-xs" textAnchor="end" x="262" y="106">
            {t("Without")}
          </text>
        </svg>

        <div className="text-muted-foreground mt-1 flex justify-between gap-3 text-xs">
          <span>{t("Today")}</span>
          <span>{t("Moving day")}</span>
        </div>
      </div>

      <div className={cn(PREVIEW_CARD_CLASS, "flex items-start gap-3 p-4")}>
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-300">
          <NotebookPenIcon className="size-[18px]" />
        </span>
        <div>
          <p className="text-sm leading-tight font-medium">{t("Mistakes notebook")}</p>
          <p className="text-muted-foreground mt-0.5 text-[13px]">
            {t("5 turn into practice on Friday")}
          </p>
        </div>
      </div>
    </div>
  );
}
