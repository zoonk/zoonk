"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { cn } from "@zoonk/ui/lib/utils";
import { type CertificateLinks, formatCertificateCode } from "@zoonk/utils/certificate-links";
import { ArrowUpRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ListGroup, ListRow, ListRowContent } from "../_components/list-group";
import { CopyButton } from "./certificate-copy-button";
import { useCertificateDate, useCertificateName } from "./certificate-labels";

type LinkedInCertificate = Pick<
  CertificateFacts,
  "code" | "completedOn" | "kind" | "level" | "targetLanguage" | "title"
>;

function useLinkedInName() {
  const t = useExtracted();
  const certificateName = useCertificateName();

  return (facts: LinkedInCertificate): string =>
    facts.kind === "placement"
      ? t({
          description:
            'A certificate\'s name on LinkedIn, such as "Spanish B1 placement result": the language and level, then the kind.',
          message: "{certificate} placement result",
          values: { certificate: certificateName(facts) },
        })
      : certificateName(facts);
}

function FieldRow({
  copy,
  label,
  mono,
  value,
}: {
  copy?: string;
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <ListRow className="items-center">
      <ListRowContent>
        <span className="text-muted-foreground text-xs">{label}</span>
        <span
          className={cn(
            "text-sm wrap-anywhere",
            mono ? "font-mono text-[0.8125rem]" : "font-medium",
          )}
        >
          {value}
        </span>
      </ListRowContent>
      {copy && <CopyButton label={copy} text={value} />}
    </ListRow>
  );
}

export function CertificateLinkedInDialog({
  facts,
  links,
  onOpenChange,
  open,
}: {
  facts: LinkedInCertificate;
  links: Pick<CertificateLinks, "linkedInUrl" | "url">;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();
  const linkedInName = useLinkedInName();
  const date = useCertificateDate();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-[540px]"
        closeLabel={t("Close")}
        overNested
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {t("Add to your LinkedIn profile")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "LinkedIn opens its form to add a license or certification. Copy each field into it.",
            )}
          </DialogDescription>
        </DialogHeader>

        <ListGroup>
          <FieldRow copy={t("Copy the name")} label={t("Name")} value={linkedInName(facts)} />
          <FieldRow
            copy={t("Copy the issuing organization")}
            label={t("Issuing organization")}
            value="Zoonk"
          />
          <FieldRow label={t("Issue date")} value={date.month(facts.completedOn)} />
          <FieldRow
            copy={t("Copy the credential ID")}
            label={t("Credential ID")}
            mono
            value={formatCertificateCode(facts.code)}
          />
          <FieldRow
            copy={t("Copy the credential URL")}
            label={t("Credential URL")}
            mono
            value={links.url}
          />
        </ListGroup>

        <DialogFooter>
          <a
            className={buttonVariants({ size: "lg" })}
            href={links.linkedInUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("Open LinkedIn")}
            <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
