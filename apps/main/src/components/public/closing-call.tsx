import { ZoonkLogo } from "@/components/brand/zoonk-logo";
import { type ReactNode } from "react";

const CLOSING_TITLE_ID = "closing-call-title";

/**
 * A landing page ends where it started: one question or promise, the page's one action again and
 * a short note under it, with nothing else to decide.
 */
export function ClosingCall({
  children,
  lead,
  note,
  title,
}: {
  children: ReactNode;
  lead: string;
  note: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby={CLOSING_TITLE_ID}
      className="mx-auto max-w-6xl px-5 pt-20 pb-20 text-center sm:px-8 sm:pt-[130px] sm:pb-[120px]"
    >
      <ZoonkLogo className="mx-auto size-10 sm:size-12" />

      <h2
        className="mt-5 text-[34px] leading-[1.08] font-bold tracking-[-0.035em] text-balance sm:mt-7 sm:text-5xl lg:text-[56px]"
        id={CLOSING_TITLE_ID}
      >
        {title}
      </h2>

      <p className="text-muted-foreground mx-auto mt-3 max-w-[640px] text-base leading-relaxed text-pretty sm:mt-4 sm:text-[19px]">
        {lead}
      </p>

      <div className="mx-auto mt-7 max-w-[720px] sm:mt-10">{children}</div>

      <p className="text-muted-foreground mt-4 text-[13px] sm:text-sm">{note}</p>
    </section>
  );
}
