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
import { useLevelName } from "../course/use-level-name";
import { useSkillName } from "../language/_utils/use-skill-name";
import { useCertificateDate, useStudyTime } from "./certificate-labels";
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

/** A locked certificate's code isn't the learner's to share yet. */
function useFactRows({ facts, locked }: { facts: CertificateFacts; locked: boolean }) {
  const t = useExtracted();
  const format = useFormatter();
  const date = useCertificateDate();
  const studyTime = useStudyTime();
  const levelName = useLevelName();
  const skillName = useSkillName();

  const skills = facts.skillLevels.map(({ label, skill }) => ({
    label: skillName(skill),
    mono: true,
    value: label,
  }));

  const rows = [
    facts.courseLevel && { label: t("Level"), mono: false, value: levelName(facts.courseLevel) },
    ...(facts.kind === "course" ? [] : skills),
    { label: t("Completed"), mono: true, value: date.short(facts.completedOn) },
    facts.lessonsStudied
      ? { label: t("Lessons studied"), mono: true, value: format.number(facts.lessonsStudied) }
      : null,
    facts.lessonsTestedOut
      ? { label: t("Passed by test"), mono: true, value: format.number(facts.lessonsTestedOut) }
      : null,
    facts.minutes ? { label: t("Study time"), mono: true, value: studyTime(facts.minutes) } : null,
    !locked && { label: t("Certificate ID"), mono: true, value: formatCertificateCode(facts.code) },
  ];

  return rows.filter((row) => typeof row === "object" && row !== null);
}

function OwnerNameRow({ facts, owner }: { facts: CertificateFacts; owner: CertificateOwner }) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);

  if (!facts.recipientName) {
    return null;
  }

  return (
    <DetailRow
      label={t({
        description: "Labels the learner's full name, as their certificates print it",
        id: "certificateRecipientName",
        message: "Name",
      })}
    >
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

/**
 * Also the picture's text equivalent: everything the certificate says, as text. A locked one
 * (`links` null) shows what was done, without the name, code or link that make it a credential.
 */
export function CertificateDetails({
  facts,
  links,
  owner,
}: {
  facts: CertificateFacts;
  links: CertificateLinks | null;
  owner: CertificateOwner | null;
}) {
  const t = useExtracted();
  const rows = useFactRows({ facts, locked: !links });
  const shared = owner && links;

  return (
    <section aria-labelledby="certificate-details" className="flex flex-col">
      <h2 className="pb-1.5 text-sm font-semibold" id="certificate-details">
        {t("Details")}
      </h2>
      <dl className="flex flex-col">
        {shared && <OwnerNameRow facts={facts} owner={owner} />}
        {rows.map((row) => (
          <DetailRow key={row.label} label={row.label} mono={row.mono}>
            {row.value}
          </DetailRow>
        ))}
        {shared && <OwnerLinkRow links={links} />}
      </dl>
      {shared && (
        <p className="text-muted-foreground border-border border-t pt-2.5 text-xs text-pretty">
          {t("Anyone with the link can see this certificate. Its page doesn't show up in search.")}
        </p>
      )}
    </section>
  );
}
