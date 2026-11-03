"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import {
  BadgeCheckIcon,
  ChevronLeftIcon,
  DownloadIcon,
  PrinterIcon,
  UserPlusIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { useCertificateDate, useCertificateSentence } from "./certificate-labels";
import { type CertificateAccount } from "./certificate-moment-copy";
import { CertificateNameField, type SaveCertificateName } from "./certificate-name";
import {
  AddToLinkedInButton,
  CertificateSharing,
  ShareCertificateButton,
} from "./certificate-sharing";
import { CertificateSheet } from "./certificate-sheet";

/** What only the certificate's owner sees on its page. */
export type CertificateOwner = {
  account: CertificateAccount;
  saveName: SaveCertificateName;
  signUpHref: string;
};

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

export function CertificateFootnote() {
  const t = useExtracted();

  return (
    <p className="text-faint text-[0.8125rem]">{t("Every Zoonk certificate has its own link.")}</p>
  );
}

export function CertificateIntro({ facts }: { facts: CertificateFacts }) {
  const t = useExtracted();
  const sentence = useCertificateSentence();
  const date = useCertificateDate();
  const issued = date.long(facts.completedOn);

  return (
    <div className="flex flex-col">
      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-[0.8125rem]">
        <BadgeCheckIcon aria-hidden="true" className="text-success size-4" />
        {t("Verified certificate · issued by Zoonk")}
      </p>
      <h1 className="text-headline mt-3.5 max-w-4xl">{sentence(facts)}</h1>
      <p className="text-lead mt-2.5">
        {facts.kind === "placement"
          ? t("Measured by Zoonk's placement test on {date}.", { date: issued })
          : t("Certificate of completion, issued on {date}.", { date: issued })}
      </p>
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
  links: CertificateLinks;
  owner: CertificateOwner;
}) {
  const t = useExtracted();

  if (owner.account === "guest") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-sm">
          {t("Create a free account to keep your certificate and put your name on it.")}
        </p>
        <PendingLink
          className={buttonVariants({ size: "lg", variant: "outline" })}
          href={owner.signUpHref}
          icon={<UserPlusIcon aria-hidden="true" />}
        >
          {t("Create a free account")}
        </PendingLink>
      </div>
    );
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
  links: CertificateLinks;
}) {
  const sentence = useCertificateSentence();
  const date = useCertificateDate();

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
