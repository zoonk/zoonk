"use client";

import { Button } from "@zoonk/ui/components/button";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { getCertificateDisplayUrl } from "@zoonk/utils/certificate-links";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function CopyButton({ label, text }: { label: string; text: string }) {
  const t = useExtracted();
  const { copy, isCopied } = useClipboard();

  return (
    <Button
      aria-label={isCopied ? undefined : label}
      className="shrink-0"
      onClick={() => void copy(text)}
      size="sm"
      type="button"
      variant="outline"
    >
      {isCopied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      <span aria-live="polite">{isCopied ? t("Copied") : t("Copy")}</span>
    </Button>
  );
}

export function CertificateLinkCopy({ url }: { url: string }) {
  const t = useExtracted();
  const address = getCertificateDisplayUrl(url);
  const codeStart = address.lastIndexOf("/") + 1;

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <span className="flex min-w-0 font-mono text-xs" title={address}>
        <span className="sr-only">{address}</span>
        <span aria-hidden="true" className="truncate">
          {address.slice(0, codeStart)}
        </span>
        <span aria-hidden="true" className="shrink-0">
          {address.slice(codeStart)}
        </span>
      </span>
      <CopyButton label={t("Copy link")} text={url} />
    </div>
  );
}
