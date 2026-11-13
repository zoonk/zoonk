"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { BottomBar } from "@zoonk/ui/components/bottom-bar";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { BackLink, PageTitle, PageTop } from "@zoonk/ui/components/page-top";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { BadgeCheckIcon, DownloadIcon, PrinterIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Eyebrow } from "../_components/eyebrow";
import { SubscribeMainAction } from "../_components/subscribe-gate";
import { LearnLink } from "../learn-link";
import { BlankCertificateSheet } from "./certificate-blank-sheet";
import { useCertificateDate, useCertificateSentence } from "./certificate-labels";
import { CertificateNameField, type SaveCertificateName } from "./certificate-name";
import {
  AddToLinkedInButton,
  CertificateSharing,
  ShareCertificateButton,
} from "./certificate-sharing";
import { CertificateSheet } from "./certificate-sheet";

/** What only the certificate's owner sees on its page. */
export type CertificateOwner = { saveName: SaveCertificateName };

/** Only the owner has a way back: to their list. A visitor's page starts at the title's height too. */
function CertificateTop({ backHref, children }: { backHref?: string; children: React.ReactNode }) {
  const t = useExtracted();
  const parent = t("Certificates");

  return (
    <PageTop
      back={
        backHref && (
          <BackLink
            aria-label={t("Back to {page}", { page: parent })}
            render={<LearnLink href={backHref} />}
          >
            {parent}
          </BackLink>
        )
      }
    >
      {children}
    </PageTop>
  );
}

/**
 * What a certificate's owner sees at its address without a subscription: the gate is the page, and
 * the blank sheet under it says which certificate is waiting.
 */
export function CertificateGate({ facts, href }: { facts: CertificateFacts; href: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col" data-slot="certificate-gate">
      <CertificateTop backHref={href}>
        <PageTitle className="max-w-4xl" variant="headline">
          {t("Certificates need a subscription")}
        </PageTitle>
      </CertificateTop>
      <BlankCertificateSheet className="mt-8 max-w-150 rounded-xl" facts={facts} />
      <BottomBar>
        <SubscribeMainAction />
      </BottomBar>
    </div>
  );
}

export function CertificateVerified({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <Eyebrow className={className} icon={<BadgeCheckIcon aria-hidden="true" />} tone="success">
      {t("Verified certificate · issued by Zoonk")}
    </Eyebrow>
  );
}

/** A date never breaks across two lines. */
function keepWhole(chunks: React.ReactNode) {
  return <span className="whitespace-nowrap">{chunks}</span>;
}

export function CertificateIntro({
  backHref,
  facts,
}: {
  backHref?: string;
  facts: CertificateFacts;
}) {
  const t = useExtracted();
  const sentence = useCertificateSentence();
  const date = useCertificateDate();

  return (
    <CertificateTop backHref={backHref}>
      <CertificateVerified className="mb-2" />
      <PageTitle className="max-w-4xl" variant="headline">
        {sentence(facts)}
      </PageTitle>
      <p className="text-lead mt-1.5">
        {t.rich("Certificate of completion, issued on <whole>{date}</whole>.", {
          date: date.long(facts.completedOn),
          whole: keepWhole,
        })}
      </p>
    </CertificateTop>
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
      className="focus-visible:ring-ring/50 block rounded-xl outline-none focus-visible:ring-[3px]"
      href={links.imageUrls.print}
      rel="noopener"
      target="_blank"
    >
      <CertificateSheet
        alt={`${sentence(facts)} · ${date.long(facts.completedOn)}`}
        className="rounded-xl"
        loading="eager"
        images={links.imageUrls}
      />
    </a>
  );
}
