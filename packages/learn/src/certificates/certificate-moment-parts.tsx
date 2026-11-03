"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { Burst } from "@zoonk/ui/components/burst";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { TASK_MAIN_ACTION_CLASS, TaskActionBar, TaskActions } from "../_components/task-layout";
import { useCertificateSentence } from "./certificate-labels";
import { CertificateSheet } from "./certificate-sheet";

/** The route's end square and the certified band sit near the sheet's lower right on every kind. */
export function MomentSheets({
  behind,
  links,
  top,
}: {
  behind: CertificateLinks | null;
  links: CertificateLinks;
  top: CertificateFacts;
}) {
  const sentence = useCertificateSentence();
  const plays = useCelebration();

  return (
    <div className="relative w-full max-w-150" data-slot="certificate-stage">
      {behind && (
        <CertificateSheet
          alt=""
          className="absolute inset-0 origin-top-right translate-x-3 -translate-y-3 scale-96 sm:translate-x-5.5 sm:-translate-y-5"
          images={behind.imageUrls}
        />
      )}

      <a
        className={cn(
          "focus-visible:ring-ring/50 relative block rounded-md outline-none focus-visible:ring-[3px]",
          plays && "animate-settle [--settle-from:0.92]",
        )}
        href={links.url}
        rel="noopener"
        target="_blank"
      >
        <CertificateSheet alt={sentence(top)} images={links.imageUrls} loading="eager" />
      </a>

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

export function GuestAction({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <PendingLink
      className={buttonVariants({ size: "lg", variant: "outline" })}
      href={href}
      icon={<UserPlusIcon aria-hidden="true" />}
    >
      {t("Create a free account")}
    </PendingLink>
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
