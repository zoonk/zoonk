"use client";

import {
  type CertificateFacts,
  type OwnedCertificateFacts,
} from "@zoonk/core/certificates/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { DialogDescription, DialogTitle } from "@zoonk/ui/components/dialog";
import { type CertificateLinks, getCertificatePath } from "@zoonk/utils/certificate-links";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useCeremonyClosing } from "../ceremonies/ceremony-closing";
import { CeremonyBar, CeremonyFrame, useCeremonyFrame } from "../ceremonies/ceremony-frame";
import { LearnLink } from "../learn-link";
import { useCertificateMomentCopy } from "./certificate-moment-copy";
import { MomentSheets, NameRow } from "./certificate-moment-parts";
import { CertificateNameField, type SaveCertificateName } from "./certificate-name";
import {
  AddToLinkedInButton,
  CertificateSharing,
  ShareCertificateButton,
} from "./certificate-sharing";

export type CertificateMomentProps = {
  /** A milestone's ceremony follows, so the result stays hidden while this one closes. */
  beforeCeremony?: boolean;
  /** Oldest first, as completion results carry them; the newest is the one on top. */
  certificates: OwnedCertificateFacts[];
  /** Asked only for certificates their owner can open. */
  getLinks: (facts: CertificateFacts) => CertificateLinks;
  onClose?: () => void;
  onShown: (code: string) => void;
  saveName: SaveCertificateName;
};

function OwnerPart({
  facts,
  links,
  onNamed,
  saveName,
  saved,
}: {
  facts: CertificateFacts;
  links: CertificateLinks;
  onNamed: (name: string) => void;
  saveName: SaveCertificateName;
  saved: string;
}) {
  const [editing, setEditing] = useState(false);
  const name = facts.recipientName;

  if (!name || editing) {
    return (
      <CertificateNameField
        current={name}
        onCancel={name ? () => setEditing(false) : undefined}
        onSaved={(newName) => {
          setEditing(false);
          onNamed(newName);
        }}
        save={saveName}
      />
    );
  }

  return (
    <>
      <NameRow name={name} onChange={() => setEditing(true)} />
      <CertificateSharing
        className="mt-5.5 flex w-full max-w-md justify-center gap-2.5"
        facts={facts}
        links={links}
      >
        <ShareCertificateButton className="flex-1 sm:flex-none" />
        <AddToLinkedInButton className="flex-1 sm:flex-none" />
      </CertificateSharing>
      <p className="text-faint text-compact mt-3.5">{saved}</p>
    </>
  );
}

/**
 * The moment a course level, a plan or a language level is certified: shown first, full screen,
 * before any milestone's ceremony and the task's own result. The name is the profile's, so fixing
 * it here fixes every certificate. Without a subscription it plays the same moment, and "See your
 * certificate" opens its page, where the gate stands; leaving that way doesn't close it, so it
 * plays again after the next task.
 */
export function CertificateMoment({
  beforeCeremony = false,
  certificates,
  getLinks,
  onClose,
  onShown,
  saveName,
}: CertificateMomentProps) {
  const t = useExtracted();
  const [savedName, setSavedName] = useState<string | null>(null);
  const onClosing = useCeremonyClosing();
  const copy = useCertificateMomentCopy(certificates);

  /** Seen once it's closed: leaving before that brings it back at the end of the next task. */
  const frame = useCeremonyFrame(() => {
    for (const { code } of certificates) {
      onShown(code);
    }

    if (!beforeCeremony) {
      onClosing();
    }
  });

  const [top, behind] = certificates
    .map((facts) => ({ ...facts, recipientName: savedName ?? facts.recipientName }))
    .toReversed();

  if (!top) {
    return null;
  }

  const links = top.locked ? null : getLinks(top);

  return (
    <CeremonyFrame
      bar={<CeremonyBar action={t("Continue")} onConfirm={() => frame.whenSteady(frame.close)} />}
      onClose={frame.close}
      onClosed={onClose}
      open={frame.open}
      slot="certificate-moment"
    >
      <MomentSheets behind={behind ?? null} getLinks={getLinks} top={top} />

      <div className="flex w-full flex-col items-center">
        <DialogTitle className="text-headline">{copy.title}</DialogTitle>
        {copy.line && (
          <DialogDescription className="text-lead mt-2 max-w-136">{copy.line}</DialogDescription>
        )}

        <div className="mt-4.5 flex w-full flex-col items-center">
          {links ? (
            <OwnerPart
              facts={top}
              links={links}
              onNamed={setSavedName}
              saveName={saveName}
              saved={copy.saved}
            />
          ) : (
            <LearnLink
              className={buttonVariants({ size: "lg", variant: "outline" })}
              href={getCertificatePath(top.code)}
            >
              {t("See your certificate")}
            </LearnLink>
          )}
        </div>
      </div>
    </CeremonyFrame>
  );
}
