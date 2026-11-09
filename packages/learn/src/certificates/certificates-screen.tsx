"use client";

import { type OwnedCertificateFacts } from "@zoonk/core/certificates/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type CertificateLinks, getCertificatePath } from "@zoonk/utils/certificate-links";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DetailContent, DetailLayout } from "../_components/detail-page";
import {
  LIST_GROUP_CLASS,
  ListRow,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
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
import { GoalMark } from "../shell/goal-mark";
import { LearnPageBar } from "../shell/learn-bar";
import {
  useCertificateDate,
  useCertificateName,
  useCertificateSentence,
} from "./certificate-labels";
import { CertificatesPlusNotice, LockedCertificateSheet } from "./certificate-lock";
import { CertificateSheet } from "./certificate-sheet";

/** `links` is null exactly when the certificate is locked. */
export type ListedCertificate = { facts: OwnedCertificateFacts; links: CertificateLinks | null };

/** A goal that can still earn a certificate: a course by finishing its plan, a language by levels. */
export type CertificateUpNext = {
  goal: { kind: string; targetLanguage: string | null; title: string };
  id: string;
  /** The plan's share of lessons done, 0 to 1; null for a language. */
  progress: number | null;
};

const LIST_ID = "certificates-list";
const UP_NEXT_ID = "certificates-up-next";

/** A locked one opens its owner's locked page, by its code: the same row, marked for Plus. */
function CertificateItem({ facts, links }: ListedCertificate) {
  const certificateName = useCertificateName();
  const t = useExtracted();
  const sentence = useCertificateSentence();
  const date = useCertificateDate();

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
          <LockedCertificateSheet className="rounded-[4px] lg:rounded-md" facts={facts} />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="group-hover:decoration-input text-sm leading-snug font-[550] tracking-[-0.01em] text-pretty group-hover:underline group-hover:underline-offset-4">
          {certificateName(facts)}
          {!links && <PlusMark className="ml-2 align-middle" />}
        </span>
        <span className="text-muted-foreground text-xs leading-snug">
          {t("Certificate of completion")}
          {" · "}
          <span className="font-mono tabular-nums">{date.short(facts.completedOn)}</span>
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
        <i className={`bg-surface-3 absolute left-[7%] block rounded-[4px] ${bar}`} key={bar} />
      ))}
      <i className="bg-input absolute top-[76%] left-[7%] block h-[2%] w-[86%] rounded-[4px]" />
      <i className="bg-surface-3 absolute top-[82%] left-[83%] block h-[14%] w-[10%] rounded-[4px]" />
    </div>
  );
}

function UpNextRow({ item }: { item: CertificateUpNext }) {
  const t = useExtracted();
  const formatShare = useFormatShare();

  return (
    <ListRow>
      <ListRowLeading>
        <GoalMark goal={item.goal} />
      </ListRowLeading>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>{item.goal.title}</ListRowTitle>
          <ListRowDescription>
            {item.progress === null
              ? t("Comes when you finish a level, studying at least half of it")
              : t("Your certificate comes when you finish the plan")}
          </ListRowDescription>
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
    <div className="flex max-w-xl flex-col gap-10">
      <div className="flex flex-col items-start">
        <GhostCertificate />
        <h2 className="mt-6 text-base font-semibold tracking-[-0.01em]">
          {t("No certificates yet")}
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm text-pretty">
          {t("Your certificates show up here when you finish a level or a plan.")}
        </p>
        <LearnLink
          className={buttonVariants({ className: "mt-5", size: "lg" })}
          href={continueHref}
        >
          {t("Continue learning")}
        </LearnLink>
      </div>

      {upNext.length > 0 && (
        <PageSection aria-labelledby={UP_NEXT_ID}>
          <PageSectionHeader>
            <PageSectionTitle id={UP_NEXT_ID}>{t("Up next")}</PageSectionTitle>
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

/** The eyebrow keeps its line while loading and when empty, so the title never moves. */
export function CertificatesHeader({ count }: { count: number | null }) {
  const t = useExtracted();

  return (
    <DetailHero>
      <DetailHeroText>
        <PageEyebrow className="flex min-h-4 items-center normal-case">
          {count === null && <Skeleton className="h-3 w-28 rounded-sm" />}
          {Boolean(count) &&
            t("{count, plural, one {# certificate} other {# certificates}}", { count: count ?? 0 })}
        </PageEyebrow>
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
      <CertificatesHeader count={certificates.length} />

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
