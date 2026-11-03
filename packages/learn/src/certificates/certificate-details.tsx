"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { Button } from "@zoonk/ui/components/button";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { cn } from "@zoonk/ui/lib/utils";
import {
  type CertificateLinks,
  formatCertificateCode,
  getCertificateDisplayUrl,
} from "@zoonk/utils/certificate-links";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { useSkillName } from "../language/_utils/use-skill-name";
import { useCertificateDate, useCourseLevels, useStudyTime } from "./certificate-labels";
import { CertificateNameDialog } from "./certificate-name";
import { type CertificateOwner } from "./certificate-page";

function DetailRow({
  children,
  label,
  mono,
}: {
  children: React.ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-t py-2.5 text-[0.8125rem]">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right",
          mono ? "font-mono text-xs tabular-nums" : "font-medium",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function useFactRows(facts: CertificateFacts) {
  const t = useExtracted();
  const format = useFormatter();
  const date = useCertificateDate();
  const studyTime = useStudyTime();
  const courseLevels = useCourseLevels();
  const skillName = useSkillName();
  const completed = date.short(facts.completedOn);

  const skills = facts.skillLevels.map(({ label, skill }) => ({
    label: skillName(skill),
    mono: true,
    value: label,
  }));

  const levels = courseLevels(facts.courseLevels);

  const rows = [
    facts.kind === "course" && levels && { label: t("Levels"), mono: false, value: levels },
    ...(facts.kind === "course" ? [] : skills),
    facts.kind === "placement"
      ? { label: t("Taken"), mono: true, value: completed }
      : { label: t("Completed"), mono: true, value: completed },
    facts.lessonsStudied
      ? { label: t("Lessons studied"), mono: true, value: format.number(facts.lessonsStudied) }
      : null,
    facts.lessonsTestedOut
      ? { label: t("Passed by test"), mono: true, value: format.number(facts.lessonsTestedOut) }
      : null,
    facts.minutes ? { label: t("Study time"), mono: true, value: studyTime(facts.minutes) } : null,
    facts.answered !== null && {
      label: t("Answers"),
      mono: true,
      value: format.number(facts.answered),
    },
    { label: t("Certificate ID"), mono: true, value: formatCertificateCode(facts.code) },
  ];

  return rows.filter((row) => typeof row === "object" && row !== null);
}

function OwnerNameRow({ facts, owner }: { facts: CertificateFacts; owner: CertificateOwner }) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);

  if (owner.account === "guest" || !facts.recipientName) {
    return null;
  }

  return (
    <DetailRow label={t("Name")}>
      {facts.recipientName}
      <Button className="ml-2 font-[550]" onClick={() => setOpen(true)} variant="link">
        {t("Change")}
      </Button>
      <CertificateNameDialog
        current={facts.recipientName}
        onOpenChange={setOpen}
        open={open}
        save={owner.saveName}
      />
    </DetailRow>
  );
}

function OwnerLinkRow({ links }: { links: CertificateLinks }) {
  const t = useExtracted();
  const { copy } = useClipboard();
  const shown = getCertificateDisplayUrl(links.url);

  return (
    <DetailRow label={t("Link")} mono>
      <span className="break-all">{shown}</span>
      <Button
        className="ml-2 font-sans font-[550]"
        onClick={() => void copy(links.url).then(() => showSuccessToast(t("Link copied")))}
        variant="link"
      >
        {t("Copy")}
      </Button>
    </DetailRow>
  );
}

/** Also the picture's text equivalent: everything the certificate says, as text. */
export function CertificateDetails({
  facts,
  links,
  owner,
}: {
  facts: CertificateFacts;
  links: CertificateLinks;
  owner: CertificateOwner | null;
}) {
  const t = useExtracted();
  const rows = useFactRows(facts);

  return (
    <section aria-labelledby="certificate-details" className="flex flex-col">
      <h2 className="pb-1.5 text-sm font-semibold" id="certificate-details">
        {t("Details")}
      </h2>
      <dl className="flex flex-col">
        {owner && <OwnerNameRow facts={facts} owner={owner} />}
        {rows.map((row) => (
          <DetailRow key={row.label} label={row.label} mono={row.mono}>
            {row.value}
          </DetailRow>
        ))}
        {owner && <OwnerLinkRow links={links} />}
      </dl>
      {owner && (
        <p className="text-muted-foreground border-border border-t pt-2.5 text-xs text-pretty">
          {t("Anyone with the link can see this certificate. Its page doesn't show up in search.")}
        </p>
      )}
    </section>
  );
}
