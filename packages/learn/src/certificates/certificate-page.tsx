"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { BadgeCheckIcon, ChevronLeftIcon, DownloadIcon, PrinterIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { useCertificateDate, useCertificateSentence } from "./certificate-labels";
import { CertificatePlusNotice, LockedCertificateSheet } from "./certificate-lock";
import { CertificateNameField, type SaveCertificateName } from "./certificate-name";
import {
  AddToLinkedInButton,
  CertificateSharing,
  ShareCertificateButton,
} from "./certificate-sharing";
import { CertificateSheet } from "./certificate-sheet";

/** What only the certificate's owner sees on its page. */
export type CertificateOwner = { saveName: SaveCertificateName };

export function CertificatesBackLink({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <LearnLink
      className={buttonVariants({
        className: "text-muted-foreground mb-3.5 -ml-2",
        size: "sm",
        variant: "ghost",
      })}
      href={href}
    >
      <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
      {t("Your certificates")}
    </LearnLink>
  );
}

export function CertificateVerified() {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground inline-flex items-center gap-1.5 text-[0.8125rem]">
      <BadgeCheckIcon aria-hidden="true" className="text-success size-4" />
      {t("Verified certificate · issued by Zoonk")}
    </p>
  );
}

/** A locked certificate (only its owner sees it) isn't issued yet, so it claims neither. */
export function CertificateIntro({ facts, locked }: { facts: CertificateFacts; locked: boolean }) {
  const t = useExtracted();
  const sentence = useCertificateSentence();
  const date = useCertificateDate();

  return (
    <div className="flex flex-col">
      {!locked && <CertificateVerified />}
      <h1 className={cn("text-headline max-w-4xl", !locked && "mt-3.5")}>{sentence(facts)}</h1>
      {!locked && (
        <p className="text-lead mt-2.5">
          {t("Certificate of completion, issued on {date}.", {
            date: date.long(facts.completedOn),
          })}
        </p>
      )}
    </div>
  );
}

/** Share leads; print and download take the print picture, which stays light whatever the theme. */
export function CertificateOwnerActions({
  facts,
  links,
  owner,
}: {
  facts: CertificateFacts;
  links: CertificateLinks | null;
  owner: CertificateOwner;
}) {
  const t = useExtracted();

  if (!links) {
    return <CertificatePlusNotice className="max-w-xl" />;
  }

  if (!facts.recipientName) {
    return <CertificateNameField current={null} save={owner.saveName} />;
  }

  return (
    <CertificateSharing
      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      facts={facts}
      links={links}
    >
      <ShareCertificateButton className="col-span-2" variant="default" />
      <Button onClick={() => globalThis.print()} size="lg" variant="outline">
        <PrinterIcon aria-hidden="true" data-icon="inline-start" />
        {t("Print")}
      </Button>
      <a
        className={buttonVariants({ size: "lg", variant: "outline" })}
        download
        href={`${links.imageUrls.print}&download=1`}
      >
        <DownloadIcon aria-hidden="true" data-icon="inline-start" />
        {t("Download")}
      </a>
      <AddToLinkedInButton className="col-span-2" />
    </CertificateSharing>
  );
}

/** Opens the picture itself, so a phone can zoom into it. */
export function CertificatePaper({
  facts,
  links,
}: {
  facts: CertificateFacts;
  links: CertificateLinks | null;
}) {
  const sentence = useCertificateSentence();
  const date = useCertificateDate();

  if (!links) {
    return <LockedCertificateSheet className="rounded-lg" facts={facts} />;
  }

  return (
    <a
      className="focus-visible:ring-ring/50 block rounded-md outline-none focus-visible:ring-[3px]"
      href={links.imageUrls.print}
      rel="noopener"
      target="_blank"
    >
      <CertificateSheet
        alt={`${sentence(facts)} · ${date.long(facts.completedOn)}`}
        className="rounded-lg"
        loading="eager"
        images={links.imageUrls}
      />
    </a>
  );
}
