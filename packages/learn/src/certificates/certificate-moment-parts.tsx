"use client";

import {
  type CertificateFacts,
  type OwnedCertificateFacts,
} from "@zoonk/core/certificates/contract";
import { Burst } from "@zoonk/ui/components/burst";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { useExtracted } from "next-intl";
import { TASK_MAIN_ACTION_CLASS, TaskActionBar, TaskActions } from "../_components/task-layout";
import { useCertificateSentence } from "./certificate-labels";
import { LockedCertificateSheet } from "./certificate-lock";
import { CertificateSheet } from "./certificate-sheet";

const BEHIND_CLASS =
  "absolute inset-0 origin-top-right translate-x-3 -translate-y-3 scale-96 sm:translate-x-5.5 sm:-translate-y-5";

function TopSheet({
  getLinks,
  top,
}: {
  getLinks: (facts: CertificateFacts) => CertificateLinks;
  top: OwnedCertificateFacts;
}) {
  const sentence = useCertificateSentence();

  if (top.locked) {
    return <LockedCertificateSheet facts={top} />;
  }

  const links = getLinks(top);

  return (
    <a
      className="focus-visible:ring-ring/50 block rounded-md outline-none focus-visible:ring-[3px]"
      href={links.url}
      rel="noopener"
      target="_blank"
    >
      <CertificateSheet alt={sentence(top)} images={links.imageUrls} loading="eager" />
    </a>
  );
}

/** The route's end square and the certified band sit near the sheet's lower right on every kind. */
export function MomentSheets({
  behind,
  getLinks,
  top,
}: {
  behind: OwnedCertificateFacts | null;
  getLinks: (facts: CertificateFacts) => CertificateLinks;
  top: OwnedCertificateFacts;
}) {
  const plays = useCelebration();

  return (
    <div className="relative w-full max-w-150" data-slot="certificate-stage">
      {behind &&
        (behind.locked ? (
          <LockedCertificateSheet className={BEHIND_CLASS} facts={behind} />
        ) : (
          <CertificateSheet alt="" className={BEHIND_CLASS} images={getLinks(behind).imageUrls} />
        ))}

      <div className={cn("relative", plays && "animate-settle [--settle-from:0.92]")}>
        <TopSheet getLinks={getLinks} top={top} />
      </div>

      <Burst className="text-success right-[7%] bottom-[22%]" delayMs={BEAT_MS} />
    </div>
  );
}

function NameStrong(chunks: React.ReactNode) {
  return <span className="text-foreground font-[550]">{chunks}</span>;
}

export function NameRow({ name, onChange }: { name: string; onChange: () => void }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-sm">
      {t.rich("On your certificate: <strong>{name}</strong>", { name, strong: NameStrong })}
      <Button className="ml-2 font-[550]" onClick={onChange} variant="link">
        {t("Change")}
      </Button>
    </p>
  );
}

export function ContinueBar({ onContinue }: { onContinue: () => void }) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      <TaskActions>
        <Button
          aria-keyshortcuts="Enter"
          autoFocus
          className={TASK_MAIN_ACTION_CLASS}
          onClick={onContinue}
          size="xl"
        >
          {t("Continue")}
          <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
        </Button>
      </TaskActions>
    </TaskActionBar>
  );
}
