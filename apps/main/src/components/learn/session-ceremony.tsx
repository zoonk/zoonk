"use client";

import { saveBuddyAction } from "@/app/[lang]/(app)/(settings)/settings/appearance/actions";
import {
  type CertificateFacts,
  type OwnedCertificateFacts,
} from "@zoonk/core/certificates/contract";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import { MilestoneCeremony } from "@zoonk/learn/ceremony";
import { CertificateMoment } from "@zoonk/learn/certificates/moment";
import { type EarnedMoments } from "@zoonk/learn/session/moment-ceremony";
import { getCertificateLinks } from "@zoonk/utils/certificate-links";
import { useState, useSyncExternalStore } from "react";
import { markCertificateShownAction, saveCertificateNameAction } from "./certificate-actions";
import { markMilestoneShownAction } from "./milestone-actions";

/** The page's origin doesn't change while it's open: nothing to listen to. */
function subscribeToOrigin(): () => void {
  return function unsubscribe() {
    // Nothing was listened to, so there's nothing to stop.
  };
}

/** Links come from the browser's own origin, so a preview's point at the preview; the server has none. */
function useBrowserOrigin(): string | null {
  return useSyncExternalStore(
    subscribeToOrigin,
    () => globalThis.location.origin,
    () => null,
  );
}

export function SessionCertificates({
  beforeCeremony = false,
  certificates,
  onClose,
}: {
  beforeCeremony?: boolean;
  certificates: OwnedCertificateFacts[];
  onClose: () => void;
}) {
  const origin = useBrowserOrigin();

  if (!origin) {
    return null;
  }

  return (
    <CertificateMoment
      beforeCeremony={beforeCeremony}
      certificates={certificates}
      getLinks={(facts: CertificateFacts) => getCertificateLinks({ ...facts, origin })}
      onClose={onClose}
      onShown={(code) => void markCertificateShownAction(code)}
      saveName={saveCertificateNameAction}
    />
  );
}

/**
 * What a result earned, full screen and rarest first: its new certificates, then its milestone. The
 * result shows only as the last one closes.
 */
export function SessionCeremony({
  buddy,
  moments,
  onClose,
}: {
  buddy: LearnBuddy | null;
  moments: EarnedMoments;
  onClose: () => void;
}) {
  const [certificatesClosed, setCertificatesClosed] = useState(moments.certificates.length === 0);
  const milestone = moments.ceremony;

  if (!certificatesClosed) {
    return (
      <SessionCertificates
        beforeCeremony={milestone !== null && milestone.kind !== "badge"}
        certificates={moments.certificates}
        onClose={milestone ? () => setCertificatesClosed(true) : onClose}
      />
    );
  }

  if (!milestone) {
    return null;
  }

  return (
    <MilestoneCeremony
      buddy={buddy}
      milestone={milestone}
      onClose={onClose}
      onShown={markMilestoneShownAction}
      onWearGlasses={
        buddy
          ? (glasses) => saveBuddyAction({ glasses, kind: buddy.kind, name: buddy.name })
          : undefined
      }
    />
  );
}
