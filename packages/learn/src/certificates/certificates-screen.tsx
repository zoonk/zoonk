"use client";

import { type OwnedCertificateFacts } from "@zoonk/core/certificates/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { type CertificateLinks, getCertificatePath } from "@zoonk/utils/certificate-links";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DetailContent, DetailLayout } from "../_components/detail-page";
import {
  LIST_GROUP_CLASS,
  ListRow,
  ListRowBody,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { Meter, MeterFill } from "../_components/meter";
import {
  PageEyebrow,
  PageSection,
  PageSectionHeader,
  PageSectionTitle,
  PageSubtitle,
} from "../_components/page";
import { PlusMark } from "../_components/plus-lock";
import { useFormatShare } from "../_utils/percent";
import { LearnLink } from "../learn-link";
import { GoalCountryName, GoalMark } from "../shell/goal-mark";
import { LearnPageBar } from "../shell/learn-bar";
import {
  useCertificateDate,
  useCertificateRowName,
  useCertificateSentence,
} from "./certificate-labels";
import { CertificatesPlusNotice, LockedCertificateSheet } from "./certificate-lock";
import { CertificateSheet } from "./certificate-sheet";

/** `links` is null exactly when the certificate is locked. */
export type ListedCertificate = { facts: OwnedCertificateFacts; links: CertificateLinks | null };

/** A goal that can still earn a certificate: a course by finishing its plan, a language by levels. */
export type CertificateUpNext = {
  goal: {
    displayName: string;
    languageFlag: string | null;
    targetLanguage: string | null;
    targetRegion: string | null;
  };
  id: string;
  /** The plan's share of lessons done, 0 to 1; null for a language. */
  progress: number | null;
};

const LIST_ID = "certificates-list";
const UP_NEXT_ID = "certificates-up-next";

/** A locked one opens its owner's locked page, by its code: the same row, marked for Plus. */
function CertificateItem({ facts, links }: ListedCertificate) {
  const rowName = useCertificateRowName();
  const sentence = useCertificateSentence();
  const date = useCertificateDate();
  const { level, name } = rowName(facts);

  return (
    <LearnLink
      className="group press focus-visible:ring-ring/50 flex items-center gap-3 rounded-lg py-2.5 outline-none [--press-scale:0.99] focus-visible:ring-[3px] lg:flex-col lg:items-stretch lg:py-0"
      href={links?.path ?? getCertificatePath(facts.code)}
      prefetch="intent"
    >
      <span className="w-18 shrink-0 lg:w-full">
        {links ? (
          <CertificateSheet
            alt={sentence(facts)}
            className="lg:rounded-md"
            loading="lazy"
            images={links.imageUrls}
            variant="thumb"
          />
        ) : (
          <LockedCertificateSheet className="rounded-sm lg:rounded-md" facts={facts} />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="group-hover:decoration-input text-sm leading-snug font-[550] tracking-[-0.01em] text-pretty group-hover:underline group-hover:underline-offset-4">
          {name}
          {!links && <PlusMark className="ml-2 align-middle" />}
        </span>
        <span className="text-muted-foreground text-xs leading-snug tabular-nums">
          {level && `${level} · `}
          {date.short(facts.completedOn)}
        </span>
      </span>

      <ChevronRightIcon
        aria-hidden="true"
        className="text-muted-foreground/60 size-4 shrink-0 lg:hidden"
      />
    </LearnLink>
  );
}

function CertificateList({ certificates }: { certificates: ListedCertificate[] }) {
  const t = useExtracted();

  return (
    <ul
      aria-label={t("Certificates")}
      className="divided-rows flex flex-col lg:grid lg:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] lg:gap-x-6 lg:gap-y-7 lg:[&>li]:border-0"
      id={LIST_ID}
    >
      {certificates.map((certificate) => (
        <li key={certificate.facts.code}>
          <CertificateItem {...certificate} />
        </li>
      ))}
    </ul>
  );
}

/** Its shapes stand for a certificate without saying one: no words, nothing to read as real. */
function GhostCertificate() {
  const bars = [
    "top-[10%] w-[16%] h-[5%]",
    "top-[30%] w-[28%] h-[4%]",
    "top-[38%] w-[52%] h-[10%]",
    "top-[53%] w-[40%] h-[6%]",
    "top-[84%] w-[46%] h-[5%]",
  ];

  return (
    <div
      aria-hidden="true"
      className="bg-ground border-input relative aspect-297/210 w-full max-w-104 rounded-lg border border-dashed"
    >
      {bars.map((bar) => (
        <i className={`bg-surface-3 absolute left-[7%] block rounded-sm ${bar}`} key={bar} />
      ))}
      <i className="bg-input absolute top-[76%] left-[7%] block h-[2%] w-[86%] rounded-sm" />
      <i className="bg-surface-3 absolute top-[82%] left-[83%] block h-[14%] w-[10%] rounded-sm" />
    </div>
  );
}

function UpNextRow({ item }: { item: CertificateUpNext }) {
  const formatShare = useFormatShare();

  return (
    <ListRow>
      <ListRowLeading>
        <GoalMark goal={item.goal} />
      </ListRowLeading>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>
            {item.goal.displayName}
            <GoalCountryName goal={item.goal} />
          </ListRowTitle>
        </ListRowContent>
        {item.progress !== null && (
          <ListRowTrailing>
            <Meter as="span" className="w-16 sm:w-30">
              <MeterFill as="span" className="bg-success" share={item.progress} />
            </Meter>
            <span className="text-foreground">{formatShare(item.progress)}</span>
          </ListRowTrailing>
        )}
      </ListRowBody>
    </ListRow>
  );
}

function EmptyCertificates({
  continueHref,
  upNext,
}: {
  continueHref: string;
  upNext: CertificateUpNext[];
}) {
  const t = useExtracted();

  return (
    <div className="flex max-w-104 flex-col gap-10">
      <div className="flex flex-col items-start">
        <GhostCertificate />
        <h2 className="mt-6 text-base font-semibold tracking-[-0.01em]">
          {t("No certificates yet")}
        </h2>
        <LearnLink
          className={buttonVariants({ className: "mt-3", size: "lg" })}
          href={continueHref}
        >
          {t("Continue learning")}
        </LearnLink>
      </div>

      {upNext.length > 0 && (
        <PageSection aria-labelledby={UP_NEXT_ID}>
          <PageSectionHeader>
            <PageSectionTitle id={UP_NEXT_ID}>{t("Your next certificate")}</PageSectionTitle>
          </PageSectionHeader>
          <ul className={LIST_GROUP_CLASS}>
            {upNext.map((item) => (
              <li key={item.id}>
                <UpNextRow item={item} />
              </li>
            ))}
          </ul>
        </PageSection>
      )}
    </div>
  );
}

/** The empty eyebrow keeps its line, so the title sits where every detail page's does. */
export function CertificatesHeader() {
  const t = useExtracted();

  return (
    <DetailHero>
      <DetailHeroText>
        <PageEyebrow aria-hidden="true" className="min-h-4" />
        <DetailTitle>{t("Certificates")}</DetailTitle>
        <PageSubtitle>{t("A certificate for every level and plan you finish.")}</PageSubtitle>
      </DetailHeroText>
    </DetailHero>
  );
}

export function CertificatesBar({ back }: { back: string }) {
  const t = useExtracted();
  return <LearnPageBar back={{ href: back }} root title={t("Certificates")} />;
}

export function CertificatesScreen({
  back,
  certificates,
  continueHref,
  plus,
  upNext,
}: {
  back: string;
  certificates: ListedCertificate[];
  continueHref: string;
  /** Whether the learner has Plus now; without it, new certificates come locked. */
  plus: boolean;
  upNext: CertificateUpNext[];
}) {
  return (
    <DetailLayout bar={<CertificatesBar back={back} />} data-slot="certificates">
      <CertificatesHeader />

      <DetailContent>
        {!plus && <CertificatesPlusNotice />}
        {certificates.length > 0 ? (
          <CertificateList certificates={certificates} />
        ) : (
          <EmptyCertificates continueHref={continueHref} upNext={upNext} />
        )}
      </DetailContent>
    </DetailLayout>
  );
}
