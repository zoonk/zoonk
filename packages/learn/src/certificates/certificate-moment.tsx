"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import {
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { useState } from "react";
import { TaskBody } from "../_components/task-layout";
import { SCREEN_STEADY_MS, useSteady } from "../_utils/use-steady";
import { useCeremonyClosing } from "../ceremonies/ceremony-closing";
import { type CertificateAccount, useCertificateMomentCopy } from "./certificate-moment-copy";
import { ContinueBar, GuestAction, MomentSheets, NameRow } from "./certificate-moment-parts";
import { CertificateNameField, type SaveCertificateName } from "./certificate-name";
import {
  AddToLinkedInButton,
  CertificateSharing,
  ShareCertificateButton,
} from "./certificate-sharing";

export type { CertificateAccount } from "./certificate-moment-copy";

export type CertificateMomentProps = {
  /**
   * A guest has no profile to name, so they're offered an account instead. Null when it isn't known
   * who's looking, which offers neither.
   */
  account: CertificateAccount | null;
  /** A milestone's ceremony follows, so the result stays hidden while this one closes. */
  beforeCeremony?: boolean;
  /** Oldest first, as completion results carry them; the newest is the one on top. */
  certificates: CertificateFacts[];
  getLinks: (facts: CertificateFacts) => CertificateLinks;
  onClose?: () => void;
  onShown: (code: string) => void;
  saveName: SaveCertificateName;
  signUpHref: (code: string) => string;
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
      <p className="text-faint mt-3.5 text-[0.8125rem]">{saved}</p>
    </>
  );
}

/**
 * The moment a course or a language level is certified: shown first, full screen, before any
 * milestone's ceremony and the task's own result. The name is the profile's, so fixing it here
 * fixes every certificate.
 */
export function CertificateMoment({
  account,
  beforeCeremony = false,
  certificates,
  getLinks,
  onClose,
  onShown,
  saveName,
  signUpHref,
}: CertificateMomentProps) {
  const [open, setOpen] = useState(true);
  const [savedName, setSavedName] = useState<string | null>(null);
  const isSteady = useSteady(SCREEN_STEADY_MS);
  const onClosing = useCeremonyClosing();
  const copy = useCertificateMomentCopy({ account, certificates });

  const [top, behind] = certificates
    .map((facts) => ({ ...facts, recipientName: savedName ?? facts.recipientName }))
    .toReversed();

  if (!top) {
    return null;
  }

  const links = getLinks(top);

  /** Seen once it's closed: leaving before that brings it back at the end of the next task. */
  const close = () => {
    setOpen(false);

    for (const { code } of certificates) {
      onShown(code);
    }

    if (!beforeCeremony) {
      onClosing();
    }
  };

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          close();
        }
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          onClose?.();
        }
      }}
      open={open}
    >
      <DialogPortal>
        <DialogPopup
          className="data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out duration-base fixed inset-0 z-50 flex flex-col overflow-y-auto"
          data-slot="certificate-moment"
        >
          <TaskBody className="items-center justify-center gap-0 pt-12 pb-16 text-center">
            <MomentSheets behind={behind ? getLinks(behind) : null} links={links} top={top} />

            <DialogTitle className="text-headline mt-8">{copy.title}</DialogTitle>
            <DialogDescription className="text-lead mt-2 max-w-136">{copy.line}</DialogDescription>

            <div className="mt-4.5 flex w-full flex-col items-center">
              {account === "guest" && <GuestAction href={signUpHref(top.code)} />}
              {account === "account" && (
                <OwnerPart
                  facts={top}
                  links={links}
                  onNamed={setSavedName}
                  saveName={saveName}
                  saved={copy.saved}
                />
              )}
            </div>
          </TaskBody>

          <ContinueBar
            onContinue={() => {
              if (isSteady()) {
                close();
              }
            }}
          />
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
