import { Link } from "@/i18n/navigation";
import { listGuardianLinks } from "@zoonk/core/minors/guardian/list-links";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../../_components/protected-section";
import { GuardianInviteForm } from "./guardian-invite-form";
import { GuardianLinks } from "./guardian-links";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Invite a parent or guardian to see your week, set a daily limit, turn memory off and approve Plus.",
    ),
    robots: { follow: false, index: false },
    title: t("Guardian"),
  };
}

/** Guests need an account first, since a guardian link belongs to the learner's account. */
async function GuestNotice() {
  const t = await getExtracted();

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground">{t("Create an account to invite a guardian.")}</p>
      <Link className={buttonVariants()} href="/login" prefetch={false}>
        {t("Create an account")}
      </Link>
    </div>
  );
}

async function GuardianContent() {
  const t = await getExtracted();

  const [session, profile, links] = await Promise.all([
    getSession(),
    getLearningProfile(),
    listGuardianLinks(),
  ]);

  if (session?.user.isAnonymous) {
    return <GuestNotice />;
  }

  if (profile && profile.ageGroup !== "teen") {
    return (
      <p className="text-muted-foreground">{t("Guardian links are for learners under 18.")}</p>
    );
  }

  const activeLinks = (links ?? []).filter((link) => link.status === "active");

  return (
    <ProtectedSection>
      <div className="flex flex-col gap-8">
        {links && links.length > 0 && <GuardianLinks links={links} />}
        <GuardianInviteForm hasGuardian={activeLinks.length > 0} />
      </div>
    </ProtectedSection>
  );
}

function GuardianSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

export default async function GuardianPage() {
  const t = await getExtracted();

  return (
    <Page>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>{t("Guardian")}</PageTitle>
          <PageSubtitle>
            {t(
              "A parent or guardian can see your weekly activity, set a daily time limit, turn memory off and approve Plus.",
            )}
          </PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      <Suspense fallback={<GuardianSkeleton />}>
        <GuardianContent />
      </Suspense>
    </Page>
  );
}
