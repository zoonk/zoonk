"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useCertificateDate, useCertificateName } from "./certificate-labels";

/**
 * A certificate its owner can't open without a subscription, in its picture's place: the sheet's
 * shape with its name and date, and no picture, code or link. Small thumbnails show only the shape.
 */
export function BlankCertificateSheet({
  className,
  facts,
}: {
  className?: string;
  facts: Pick<
    CertificateFacts,
    "completedOn" | "courseLevel" | "kind" | "level" | "targetLanguage" | "title"
  >;
}) {
  const certificateName = useCertificateName();
  const date = useCertificateDate();

  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground @container flex aspect-297/210 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md p-[6%] text-center shadow-[inset_0_0_0_1px_var(--color-border)]",
        className,
      )}
      data-slot="blank-certificate"
    >
      <span className="text-foreground hidden max-w-full text-base font-semibold text-balance @3xs:block @md:text-lg">
        {certificateName(facts)}
      </span>
      <span className="hidden font-mono text-xs tabular-nums @3xs:block">
        {date.long(facts.completedOn)}
      </span>
    </span>
  );
}
