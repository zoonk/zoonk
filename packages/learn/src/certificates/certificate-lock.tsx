"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { LockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlusNotice } from "../_components/plus-lock";
import { useCertificateDate, useCertificateName } from "./certificate-labels";

/**
 * A locked certificate in its picture's place: the sheet's shape with its name and date, and no
 * picture, code or link until the learner has Plus. Small thumbnails show only the lock.
 */
export function LockedCertificateSheet({
  className,
  facts,
}: {
  className?: string;
  facts: Pick<CertificateFacts, "cefrRange" | "completedOn" | "courseLevel" | "title">;
}) {
  const t = useExtracted();
  const certificateName = useCertificateName();
  const date = useCertificateDate();

  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground @container flex aspect-297/210 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md p-[6%] text-center shadow-[0_0_0_1px_var(--color-border)]",
        className,
      )}
      data-slot="locked-certificate"
    >
      <LockIcon aria-hidden="true" className="size-5 shrink-0 @3xs:size-6" />
      <span className="sr-only">{t("Locked")}</span>
      <span className="text-foreground hidden max-w-full text-base font-semibold text-balance @3xs:block @md:text-lg">
        {certificateName(facts)}
      </span>
      <span className="hidden font-mono text-xs tabular-nums @3xs:block">
        {date.long(facts.completedOn)}
      </span>
    </span>
  );
}

/** Where a locked certificate is shown: the moment, its page. */
export function CertificatePlusNotice({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <PlusNotice className={className} title={t("Get your certificate with Plus")}>
      {t(
        "Plus gives you a certificate for every level you finish, to print and share. Certificates you get stay yours if Plus ends.",
      )}
    </PlusNotice>
  );
}

/** Atop Certificates while the learner isn't on Plus, empty or not. */
export function CertificatesPlusNotice() {
  const t = useExtracted();

  return (
    <PlusNotice className="max-w-xl" title={t("Certificates come with Plus")}>
      {t(
        "Plus gives you a certificate for every level you finish, to print and share. Certificates you get stay yours if Plus ends.",
      )}
    </PlusNotice>
  );
}
