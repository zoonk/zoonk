"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCertificateName, useCertificateSentence } from "./certificate-labels";
import { type CertificateAccount } from "./certificate-moment";
import { CertificateSheet } from "./certificate-sheet";

export type LevelTestPlacement = {
  account: CertificateAccount;
  facts: CertificateFacts;
  links: CertificateLinks;
};

/**
 * A placement is a starting point, not an achievement, so the level test's last screen shows it as
 * a quiet row instead of the full-screen moment.
 */
export function PlacementRow({ account, facts, links }: LevelTestPlacement) {
  const t = useExtracted();
  const certificateName = useCertificateName();
  const sentence = useCertificateSentence();

  return (
    <a
      className="bg-muted hover:bg-muted/70 press focus-visible:ring-ring/50 -mx-3 flex items-center gap-3.5 rounded-xl p-3 text-left outline-none [--press-scale:0.99] focus-visible:ring-[3px]"
      data-slot="placement-row"
      href={links.url}
      rel="noopener"
      target="_blank"
    >
      <span className="w-21 shrink-0">
        <CertificateSheet alt={sentence(facts)} images={links.imageUrls} variant="thumb" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-sm leading-snug font-medium text-pretty">
          {t("Placement result: {certificate}", { certificate: certificateName(facts) })}
        </span>
        <span className="text-muted-foreground text-xs leading-snug">
          {account === "guest"
            ? t("Create a free account to keep it and share it.")
            : t("Saved in your certificates. Share it anytime.")}
        </span>
      </span>

      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-4 shrink-0" />
    </a>
  );
}
