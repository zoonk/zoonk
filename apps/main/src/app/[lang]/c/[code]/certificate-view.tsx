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
  CertificateIntro,
  CertificateOwnerActions,
  CertificatePaper,
  CertificatesBackLink,
} from "@zoonk/learn/certificates/page";
import { cn } from "@zoonk/ui/lib/utils";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { CertificatePrint } from "./certificate-print";

const BAND_CLASS = cn(PUBLIC_CONTAINER_CLASS, "py-14 sm:py-16");

/** `links` is null for a locked certificate, which only its owner sees. */
export function CertificateView({
  facts,
  links,
  owner,
  startHref,
}: {
  facts: CertificateFacts;
  links: CertificateLinks | null;
  owner: boolean;
  startHref: string | null;
}) {
  const ownerActions = owner ? { saveName: saveCertificateNameAction } : null;

  return (
    <>
      <section className="bg-ground">
        <div className={cn(PUBLIC_CONTAINER_CLASS, "pt-8 pb-14 sm:pt-12 sm:pb-16")}>
          {ownerActions && <CertificatesBackLink href="/certificates" />}
          <CertificateIntro facts={facts} locked={!links} />

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

      {links && <CertificatePrint src={links.imageUrls.print} />}
    </>
  );
}
