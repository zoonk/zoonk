import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { PublicPage } from "@/components/public/public-page";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { getAppLocale } from "@/i18n/locale";
import { getPathname } from "@/i18n/navigation";
import { getCourseStartHref } from "@/lib/public/public-hrefs";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { listCurrentUserCertificates } from "@zoonk/core/certificates/list";
import { getPublicCertificate } from "@zoonk/core/certificates/public";
import { getSession } from "@zoonk/core/users/session";
import { CertificateVerified } from "@zoonk/learn/certificates/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { getCertificateLinks } from "@zoonk/utils/certificate-links";
import { getLanguageName } from "@zoonk/utils/languages";
import { getBaseUrl } from "@zoonk/utils/origin";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense, cache } from "react";
import { CertificateNotFound } from "./certificate-not-found";
import { CertificateView } from "./certificate-view";
import "./certificate-print.css";

type Props = PageProps<"/[lang]/c/[code]">;

/** One read per request, shared by the metadata and the page. */
const readCertificate = cache((code: string) => getPublicCertificate(code));

/** The page's own origin, so a preview's links and pictures point at the preview. */
function getLinks(facts: CertificateFacts) {
  return getCertificateLinks({ ...facts, origin: getBaseUrl() });
}

function getMetadataTitle(facts: CertificateFacts): string {
  const certificate =
    facts.title ??
    `${facts.targetLanguage ? getLanguageName({ targetLanguage: facts.targetLanguage, userLanguage: facts.language }) : ""} ${facts.level ?? ""}`.trim();

  return facts.recipientName ? `${facts.recipientName} · ${certificate}` : certificate;
}

/** No index and no follow: a certificate is shared by its link, never found by search. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getExtracted();
  const { code } = await params;
  const facts = await readCertificate(code);
  const robots = { follow: false, index: false };

  if (!facts) {
    return { robots, title: t("We couldn't find this certificate") };
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

async function readOwner(code: string) {
  const [session, owned] = await Promise.all([getSession(), listCurrentUserCertificates()]);
  const isOwner = owned.status === "ready" && owned.certificates.some((item) => item.code === code);

  if (!session || !isOwner) {
    return null;
  }

  return { account: session.user.isAnonymous ? ("guest" as const) : ("account" as const) };
}

async function CertificateBody({ params }: Props) {
  const { code } = await params;
  const facts = await readCertificate(code);

  if (!facts) {
    return <CertificateNotFound />;
  }

  const [owner, locale] = await Promise.all([readOwner(facts.code), getAppLocale()]);
  const links = getLinks(facts);
  const pagePath = getPathname({ href: links.path, locale });

  return (
    <CertificateView
      facts={facts}
      links={links}
      owner={
        owner && {
          account: owner.account,
          signUpHref: `${getPathname({ href: "/login", locale })}?next=${encodeURIComponent(pagePath)}`,
        }
      }
      startHref={facts.courseId ? getCourseStartHref({ courseId: facts.courseId }) : null}
    />
  );
}

/** As tall as the screen, so the footer under it doesn't jump when the certificate arrives. */
function CertificateSkeleton() {
  return (
    <div aria-busy="true" className="bg-ground min-h-dvh">
      <div className={cn(PUBLIC_CONTAINER_CLASS, "pt-6 pb-16")}>
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
