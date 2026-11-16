import { AuthGatePage } from "@/components/auth-gate";
import { listCurrentUserCertificates } from "@zoonk/core/certificates/list";
import { listCurrentUserCertificateProgress } from "@zoonk/core/certificates/progress";
import {
  CertificatesBar,
  CertificatesHeader,
  CertificatesScreen,
} from "@zoonk/learn/certificates/list";
import { PAGE_COLUMN_CLASS } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getCertificateLinks } from "@zoonk/utils/certificate-links";
import { getBaseUrl } from "@zoonk/utils/origin";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

const BACK_HREF = "/today";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Certificates") };
}

async function CertificatesContent() {
  const result = await listCurrentUserCertificates();

  if (result.status !== "ready") {
    const t = await getExtracted();

    return (
      <>
        <CertificatesBar back={BACK_HREF} />
        <AuthGatePage
          description={t("A certificate for every level and plan you finish.")}
          next="/certificates"
          title={t("Certificates")}
        />
      </>
    );
  }

  const certificateProgress =
    result.certificates.length === 0 ? await listCurrentUserCertificateProgress() : null;

  const origin = getBaseUrl();

  return (
    <CertificatesScreen
      back={BACK_HREF}
      certificates={result.certificates.map((facts) => ({
        facts,
        links: facts.locked ? null : getCertificateLinks({ ...facts, origin }),
      }))}
      continueHref={BACK_HREF}
      upNext={
        certificateProgress?.status === "ready"
          ? certificateProgress.upNext.map(({ id, progress, ...goal }) => ({ goal, id, progress }))
          : []
      }
    />
  );
}

function CertificatesSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <CertificatesBar back={BACK_HREF} />
      <div className={`${PAGE_COLUMN_CLASS} flex flex-col gap-8`}>
        <CertificatesHeader />
        <div className="grid gap-x-6 gap-y-7 lg:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="flex items-center gap-3 lg:flex-col lg:items-stretch" key={index}>
              <Skeleton className="aspect-297/210 w-18 shrink-0 rounded-sm lg:w-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-48 max-w-2/3 rounded-sm" />
                <Skeleton className="h-3 w-32 max-w-1/2 rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CertificatesPage() {
  return (
    <Suspense fallback={<CertificatesSkeleton />}>
      <CertificatesContent />
    </Suspense>
  );
}
