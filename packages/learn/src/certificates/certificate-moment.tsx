"use client";

import {
  type CertificateFacts,
  type OwnedCertificateFacts,
} from "@zoonk/core/certificates/contract";
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
import { CertificatePlusNotice } from "./certificate-lock";
import { useCertificateMomentCopy } from "./certificate-moment-copy";
import { ContinueBar, MomentSheets, NameRow } from "./certificate-moment-parts";
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
  /** Asked only for unlocked certificates. */
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
      <p className="text-faint mt-3.5 text-[0.8125rem]">{saved}</p>
    </>
  );
}

/**
 * The moment a course level, a plan or a language level is certified: shown first, full screen,
 * before any milestone's ceremony and the task's own result. The name is the profile's, so fixing
 * it here fixes every certificate. A locked one plays the same moment with the Plus notice; See
 * Plus leaves without closing it, so it plays again after the next task.
 */
export function CertificateMoment({
  beforeCeremony = false,
  certificates,
  getLinks,
  onClose,
  onShown,
  saveName,
}: CertificateMomentProps) {
  const [open, setOpen] = useState(true);
  const [savedName, setSavedName] = useState<string | null>(null);
  const isSteady = useSteady(SCREEN_STEADY_MS);
  const onClosing = useCeremonyClosing();
  const copy = useCertificateMomentCopy(certificates);

  const [top, behind] = certificates
    .map((facts) => ({ ...facts, recipientName: savedName ?? facts.recipientName }))
    .toReversed();

  if (!top) {
    return null;
  }

  const links = top.locked ? null : getLinks(top);

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
            <MomentSheets behind={behind ?? null} getLinks={getLinks} top={top} />

            <DialogTitle className="text-headline mt-8">{copy.title}</DialogTitle>
            {copy.line && (
              <DialogDescription className="text-lead mt-2 max-w-136">
                {copy.line}
              </DialogDescription>
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
                <CertificatePlusNotice className="max-w-md text-left" />
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
