import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { PublicPage } from "@/components/public/public-page";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { getCourseStartHref } from "@/lib/public/public-hrefs";
import { type CertificateFacts, normalizeCertificateCode } from "@zoonk/core/certificates/contract";
import { listCurrentUserCertificates } from "@zoonk/core/certificates/list";
import { getPublicCertificate } from "@zoonk/core/certificates/public";
import { CertificateVerified } from "@zoonk/learn/certificates/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { getCertificateLinks, getCertificateName } from "@zoonk/utils/certificate-links";
import { getBaseUrl } from "@zoonk/utils/origin";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense, cache } from "react";
import { CertificateNotFound } from "./certificate-not-found";
import { CertificateView } from "./certificate-view";
import "./certificate-print.css";

type Props = PageProps<"/[lang]/c/[code]">;

/**
 * One read per request, shared by the metadata and the page. A locked certificate is only its
 * owner's: anyone else gets the page an unknown code gets.
 */
const readCertificate = cache(async (code: string) => {
  const normalized = normalizeCertificateCode(code);

  if (!normalized) {
    return null;
  }

  const [facts, owned] = await Promise.all([
    getPublicCertificate(normalized),
    listCurrentUserCertificates(),
  ]);

  const own =
    owned.status === "ready"
      ? owned.certificates.find((certificate) => certificate.code === normalized)
      : undefined;

  if (own?.locked) {
    return { facts: own, locked: true, owner: true };
  }

  return facts && { facts, locked: false, owner: Boolean(own) };
});

/** The page's own origin, so a preview's links and pictures point at the preview. */
function getLinks(facts: CertificateFacts) {
  return getCertificateLinks({ ...facts, origin: getBaseUrl() });
}

function getMetadataTitle(facts: CertificateFacts): string {
  const certificate = getCertificateName(facts);
  return facts.recipientName ? `${facts.recipientName} · ${certificate}` : certificate;
}

/** No index and no follow: a certificate is shared by its link, never found by search. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getExtracted();
  const { code } = await params;
  const read = await readCertificate(code);
  const robots = { follow: false, index: false };

  if (!read) {
    return { robots, title: t("We couldn't find this certificate") };
  }

  const { facts } = read;

  if (read.locked) {
    return { robots, title: getMetadataTitle(facts) };
  }

  const { imageUrls } = getLinks(facts);
  const title = getMetadataTitle(facts);
  const description = t("A certificate issued by Zoonk. Anyone with its link can check it.");
  const images = [{ alt: title, height: 630, url: imageUrls.link, width: 1200 }];

  return {
    description,
    openGraph: { description, images, title, type: "website" },
    robots,
    title,
    twitter: { card: "summary_large_image", description, images, title },
  };
}

async function CertificateBody({ params }: Props) {
  const { code } = await params;
  const read = await readCertificate(code);

  if (!read) {
    return <CertificateNotFound />;
  }

  const { facts } = read;

  return (
    <CertificateView
      facts={facts}
      links={read.locked ? null : getLinks(facts)}
      owner={read.owner}
      startHref={facts.courseId ? getCourseStartHref({ courseId: facts.courseId }) : null}
    />
  );
}

/** As tall as the screen, so the footer under it doesn't jump when the certificate arrives. */
function CertificateSkeleton() {
  return (
    <div aria-busy="true" className="bg-ground min-h-dvh">
      <div className={cn(PUBLIC_CONTAINER_CLASS, "pt-8 pb-16 sm:pt-12")}>
        <CertificateVerified />
        <Skeleton className="mt-4 h-10 w-full max-w-2xl" />
        <Skeleton className="mt-2 h-10 w-2/3 max-w-xl" />
        <Skeleton className="mt-4 h-5 w-80 max-w-full" />
        <div className="mt-8 grid items-start gap-7 min-[72rem]:grid-cols-[minmax(0,1fr)_320px] min-[72rem]:gap-12">
          <Skeleton className="aspect-297/210 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CertificatePage(props: Props) {
  return (
    <PublicPage>
      <ClientMessagesProvider scope="learn">
        <MainLearnProvider>
          <Suspense fallback={<CertificateSkeleton />}>
            <CertificateBody {...props} />
          </Suspense>
        </MainLearnProvider>
      </ClientMessagesProvider>
    </PublicPage>
  );
}
