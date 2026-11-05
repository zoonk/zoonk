"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { Button } from "@zoonk/ui/components/button";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { ArrowUpRightIcon, ShareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use, useState } from "react";
import { CertificateLinkedInDialog } from "./certificate-linkedin";
import { CertificateShareDialog, useShareCertificate } from "./certificate-share";

type Sharing = { openLinkedIn: () => void; prepare: () => void; share: () => Promise<void> };

const SharingContext = createContext<Sharing | null>(null);

function useSharing(): Sharing {
  const sharing = use(SharingContext);

  if (!sharing) {
    throw new Error("Certificate sharing buttons must be inside CertificateSharing");
  }

  return sharing;
}

/** Share and Add to LinkedIn, with the dialogs they open; callers place the buttons. */
export function CertificateSharing({
  children,
  className,
  facts,
  links,
}: {
  children: React.ReactNode;
  className?: string;
  facts: CertificateFacts;
  links: CertificateLinks;
}) {
  const [dialog, setDialog] = useState<"linkedin" | "share" | null>(null);

  const { prepare, share } = useShareCertificate({
    facts,
    links,
    openDialog: () => setDialog("share"),
  });

  return (
    <SharingContext value={{ openLinkedIn: () => setDialog("linkedin"), prepare, share }}>
      <div className={className} data-slot="certificate-sharing">
        {children}
      </div>

      <CertificateShareDialog
        facts={facts}
        links={links}
        onOpenChange={(open) => setDialog(open ? "share" : null)}
        open={dialog === "share"}
      />
      <CertificateLinkedInDialog
        facts={facts}
        links={links}
        onOpenChange={(open) => setDialog(open ? "linkedin" : null)}
        open={dialog === "linkedin"}
      />
    </SharingContext>
  );
}

export function ShareCertificateButton({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: "default" | "outline";
}) {
  const t = useExtracted();
  const { prepare, share } = useSharing();

  return (
    <Button
      className={className}
      onClick={() => void share()}
      onPointerDown={prepare}
      size="lg"
      variant={variant}
    >
      <ShareIcon aria-hidden="true" data-icon="inline-start" />
      {t("Share")}
    </Button>
  );
}

export function AddToLinkedInButton({ className }: { className?: string }) {
  const t = useExtracted();
  const { openLinkedIn } = useSharing();

  return (
    <Button className={className} onClick={openLinkedIn} size="lg" variant="outline">
      <ArrowUpRightIcon aria-hidden="true" data-icon="inline-start" />
      {t("Add to LinkedIn")}
    </Button>
  );
}
