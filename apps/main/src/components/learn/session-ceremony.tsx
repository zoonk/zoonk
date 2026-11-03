"use client";

import { saveBuddyAction } from "@/app/[lang]/(app)/(settings)/settings/appearance/actions";
import { getPathname } from "@/i18n/navigation";
import { type LearnerSummaryState } from "@/lib/learner/learner-snapshot";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import { MilestoneCeremony } from "@zoonk/learn/ceremony";
import { type CertificateAccount, CertificateMoment } from "@zoonk/learn/certificates/moment";
import { useAppLocale } from "@zoonk/learn/locale";
import { type EarnedMoments } from "@zoonk/learn/session/moment-ceremony";
import { getCertificateLinks, getCertificatePath } from "@zoonk/utils/certificate-links";
import { useState } from "react";
import { markCertificateShownAction, saveCertificateNameAction } from "./certificate-actions";
import { markMilestoneShownAction } from "./milestone-actions";

/** Built in the browser from its own origin, so a preview's links point at the preview. */
function getBrowserCertificateLinks(facts: CertificateFacts) {
  return getCertificateLinks({ ...facts, origin: globalThis.location.origin });
}

/** Naming and sharing need a known account, and a guest is offered one instead; a failed read offers neither. */
function getViewerAccount(learner: LearnerSummaryState): CertificateAccount | null {
  if (learner.status !== "ready") {
    return null;
  }

  return learner.summary.identity.isAnonymous ? "guest" : "account";
}

export function SessionCertificates({
  beforeCeremony = false,
  certificates,
  onClose,
}: {
  beforeCeremony?: boolean;
  certificates: CertificateFacts[];
  onClose: () => void;
}) {
  const locale = useAppLocale();
  const learner = useLearnerSummary();

  // Waits to know who's looking. The server never knows, so the links built from the browser's
  // origin never render there.
  if (learner.status === "not-loaded") {
    return null;
  }

  return (
    <CertificateMoment
      account={getViewerAccount(learner)}
      beforeCeremony={beforeCeremony}
      certificates={certificates}
      getLinks={getBrowserCertificateLinks}
      onClose={onClose}
      onShown={(code) => void markCertificateShownAction(code)}
      saveName={saveCertificateNameAction}
      signUpHref={(code) =>
        `${getPathname({ href: "/login", locale })}?next=${encodeURIComponent(getPathname({ href: getCertificatePath(code), locale }))}`
      }
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
