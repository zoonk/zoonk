"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { BadgeCheckIcon, ChevronLeftIcon, DownloadIcon, PrinterIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterLink } from "../_components/enter-button";
import { useLearnRoutes } from "../learn-context";
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

/**
 * Where a title's first letter starts inside its box, in ems of Geist: a round letter by 0.053, a
 * stem by 0.08, a diagonal or a bar by 0.02. Any other letter or script takes the round one.
 */
function titleBearingClass(text: string) {
  const first = text.trimStart().charAt(0);

  if ("AJTVWXYvwxy".includes(first)) {
    return "[--title-bearing:0.02]";
  }

  if ("BDEFHIKLMNPRUbhiklmnpru".includes(first)) {
    return "[--title-bearing:0.08]";
  }

  return "[--title-bearing:0.053]";
}

/**
 * The kit's pull puts the arrow's ink on the column's edge; the 34 px title under it (48 px from
 * 40rem) starts its first letter further in, so the link moves by that letter's start, to a whole
 * pixel and never left of the edge.
 */
function BackLink({ href, title }: { href: string; title: string }) {
  const t = useExtracted();

  return (
    <LearnLink
      className={buttonVariants({
        className: cn(
          "text-muted-foreground relative left-[round(var(--title-size)*var(--title-bearing),1px)] mb-3.5 [--title-size:2.125rem] sm:[--title-size:3rem]",
          titleBearingClass(title),
        ),
        edge: "start",
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

export function CertificatesBackLink({ facts, href }: { facts: CertificateFacts; href: string }) {
  const sentence = useCertificateSentence();
  return <BackLink href={href} title={sentence(facts)} />;
}

/**
 * What a certificate's owner sees at its address without a subscription: the gate is the page, and
 * the blank sheet under it says which certificate is waiting.
 */
export function CertificateGate({ facts, href }: { facts: CertificateFacts; href: string }) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const title = t("Certificates need a subscription");

  return (
    <div className="flex flex-col items-start" data-slot="certificate-gate">
      <BackLink href={href} title={title} />
      <h1 className="text-headline max-w-4xl">{title}</h1>
      <EnterLink className="mt-6 w-full sm:w-auto" href={routes.upgrade} size="lg">
        {t("Subscribe")}
      </EnterLink>
      <BlankCertificateSheet className="mt-8 max-w-150 rounded-xl" facts={facts} />
    </div>
  );
}

export function CertificateVerified() {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-compact inline-flex items-center gap-1.5">
      <BadgeCheckIcon aria-hidden="true" className="text-success size-4" />
      {t("Verified certificate · issued by Zoonk")}
    </p>
  );
}

/** A date never breaks across two lines. */
function keepWhole(chunks: React.ReactNode) {
  return <span className="whitespace-nowrap">{chunks}</span>;
}

export function CertificateIntro({ facts }: { facts: CertificateFacts }) {
  const t = useExtracted();
  const sentence = useCertificateSentence();
  const date = useCertificateDate();

  return (
    <div className="flex flex-col">
      <CertificateVerified />
      <h1 className="text-headline mt-3.5 max-w-4xl">{sentence(facts)}</h1>
      <p className="text-lead mt-2.5">
        {t.rich("Certificate of completion, issued on <whole>{date}</whole>.", {
          date: date.long(facts.completedOn),
          whole: keepWhole,
        })}
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
