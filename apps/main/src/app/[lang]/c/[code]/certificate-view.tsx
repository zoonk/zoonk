"use client";

import { saveCertificateNameAction } from "@/components/learn/certificate-actions";
import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { CertificateDetails } from "@zoonk/learn/certificates/details";
import {
  CertificateCovered,
  CertificateMeaning,
  CertificateStart,
} from "@zoonk/learn/certificates/meaning";
import {
  CertificateFootnote,
  CertificateIntro,
  type CertificateOwner,
  CertificateOwnerActions,
  CertificatePaper,
  CertificatesBackLink,
} from "@zoonk/learn/certificates/page";
import { cn } from "@zoonk/ui/lib/utils";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { CertificatePrint } from "./certificate-print";

const BAND_CLASS = cn(PUBLIC_CONTAINER_CLASS, "py-14 sm:py-16");

export function CertificateView({
  facts,
  links,
  owner,
  startHref,
}: {
  facts: CertificateFacts;
  links: CertificateLinks;
  owner: Omit<CertificateOwner, "saveName"> | null;
  startHref: string | null;
}) {
  const ownerActions = owner && { ...owner, saveName: saveCertificateNameAction };

  return (
    <>
      <section className="bg-ground">
        <div className={cn(PUBLIC_CONTAINER_CLASS, "pt-6 pb-14 sm:pb-16")}>
          {ownerActions && <CertificatesBackLink href="/certificates" />}
          <CertificateIntro facts={facts} />

          {ownerActions && (
            <div className="mt-6">
              <CertificateOwnerActions facts={facts} links={links} owner={ownerActions} />
            </div>
          )}

          <div className="mt-8 grid items-start gap-7 min-[72rem]:grid-cols-[minmax(0,1fr)_320px] min-[72rem]:gap-12">
            <CertificatePaper facts={facts} links={links} />
            <CertificateDetails facts={facts} links={links} owner={ownerActions} />
          </div>
        </div>
      </section>

      <section>
        <div className={BAND_CLASS}>
          <CertificateMeaning facts={facts} />
          <CertificateCovered facts={facts} />
        </div>
      </section>

      {!owner && startHref && (
        <section className="bg-ground">
          <div className={cn(PUBLIC_CONTAINER_CLASS, "py-11")}>
            <CertificateStart facts={facts} href={startHref} />
          </div>
        </section>
      )}

      <div className={cn(PUBLIC_CONTAINER_CLASS, "py-6")}>
        <CertificateFootnote />
      </div>

      <CertificatePrint src={links.imageUrls.print} />
    </>
  );
}
