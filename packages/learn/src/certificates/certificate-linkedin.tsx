"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { EnterLink, type EnterLinkHostProps } from "@zoonk/ui/components/enter-button";
import { cn } from "@zoonk/ui/lib/utils";
import { type CertificateLinks, formatCertificateCode } from "@zoonk/utils/certificate-links";
import { useExtracted } from "next-intl";
import { ListGroup, ListRow, ListRowContent } from "../_components/list-group";
import { SheetHeader } from "../_components/sheet-header";
import { SoftBreaks } from "../_components/soft-breaks";
import { CopyButton } from "./certificate-copy-button";
import { useCertificateDate, useCertificateName } from "./certificate-labels";

/** LinkedIn's form opens in a new tab, so this page stays where the learner copies from. */
function NewTabLink({ children, ...props }: EnterLinkHostProps) {
  return (
    <a {...props} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
}

type LinkedInCertificate = Pick<
  CertificateFacts,
  "code" | "completedOn" | "courseLevel" | "kind" | "level" | "targetLanguage" | "title"
>;

/** "Python · Beginner" wraps before its last words, never leaving the level alone on a line. */
function keepLevelWithName(value: string): string {
  return value.replaceAll(" · ", "\u00A0·\u00A0");
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
          className={cn("text-sm wrap-anywhere", mono ? "text-compact font-mono" : "font-medium")}
        >
          {mono ? <SoftBreaks>{value}</SoftBreaks> : keepLevelWithName(value)}
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
  const certificateName = useCertificateName();
  const date = useCertificateDate();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle>{t("Add to your LinkedIn profile")}</DrawerTitle>
          <DrawerDescription>
            {t(
              "LinkedIn opens its form to add a license or certification. Copy each field into it.",
            )}
          </DrawerDescription>
        </SheetHeader>

        <DrawerContent className="flex flex-col gap-5 pt-2">
          <ListGroup>
            <FieldRow
              copy={t("Copy the name")}
              label={t({
                description:
                  "LinkedIn's field for the certificate's name, labeled as in LinkedIn's \"Add license or certification\" form",
                id: "linkedInCertificationName",
                message: "Name",
              })}
              value={certificateName(facts)}
            />
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
        </DrawerContent>

        <DrawerFooter>
          <EnterLink href={links.linkedInUrl} link={NewTabLink}>
            {t("Open LinkedIn")}
          </EnterLink>
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}
