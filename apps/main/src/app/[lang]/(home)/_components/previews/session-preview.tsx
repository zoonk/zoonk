import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleIcon, CirclePlayIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

function SessionBlock({
  detail,
  icon,
  isCurrent,
  minutes,
  title,
}: {
  detail: string;
  icon: ReactNode;
  isCurrent?: boolean;
  minutes: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl px-2 py-1.5 text-sm leading-snug",
        isCurrent && "bg-muted dark:bg-neutral-700/60",
      )}
    >
      {/* The icon and the minutes sit on the title's first line, however many lines it takes. */}
      <LineMarker>{icon}</LineMarker>
      <div className="min-w-0 flex-1">
        <p className={cn("text-pretty", isCurrent && "font-medium")}>{title}</p>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </div>
      <LineMarker>
        <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          {minutes}
        </span>
      </LineMarker>
    </div>
  );
}

/** Today's session, ready when the app opens: a review, the next lesson, speaking and mistakes. */
export async function SessionPreview() {
  const t = await getExtracted();

  return (
    <div aria-hidden="true" className={cn(PREVIEW_CARD_CLASS, "p-4")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold">{t("Today's session")}</p>
        <p className="text-muted-foreground text-[13px] whitespace-nowrap tabular-nums">
          {t("4 of 20 min")}
        </p>
      </div>

      <div className="bg-muted mt-3 h-1 rounded-full dark:bg-neutral-700">
        <div className="bg-foreground h-full w-1/5 rounded-full" />
      </div>

      <div className="-mx-2 mt-2">
        <SessionBlock
          detail={t("8 cards")}
          icon={
            <CircleCheckIcon className="size-[18px] flex-none text-emerald-600 dark:text-emerald-400" />
          }
          minutes={t("4 min")}
          title={t("Quick review")}
        />
        <SessionBlock
          detail={t("Lesson + 6 questions")}
          icon={<CirclePlayIcon className="size-[18px] flex-none" />}
          isCurrent
          minutes={t("7 min")}
          title={t("Calling about an apartment")}
        />
        <SessionBlock
          detail={t("Pronunciation tips")}
          icon={<CircleIcon className="text-muted-foreground/60 size-[18px] flex-none" />}
          minutes={t("5 min")}
          title={t("Speaking: leave a voicemail")}
        />
        <SessionBlock
          detail={t("3 to practice")}
          icon={<CircleIcon className="text-muted-foreground/60 size-[18px] flex-none" />}
          minutes={t("4 min")}
          title={t("Tuesday's mistakes")}
        />
      </div>

      <span className="bg-primary text-primary-foreground mt-3 flex min-h-10 w-full items-center justify-center rounded-full px-4 py-2 text-center text-sm font-medium">
        {t("Continue")}
      </span>
    </div>
  );
}
