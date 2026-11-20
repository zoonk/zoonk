import { SectionPageHeader } from "@/components/learn/section-page";
import { getSession } from "@zoonk/core/users/session";
import { FeedbackForm, FeedbackFormSkeleton } from "@zoonk/learn/feedback/form";
import { Page } from "@zoonk/learn/page";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { FollowUs } from "../_components/follow-us";

/** From `xl` whoever has a session finds it in the section's aside instead. */
function FollowUsOnPage() {
  return (
    <div className="contents xl:in-data-signed-in:hidden">
      <FollowUs />
    </div>
  );
}

async function ContactSupport({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  const email = session && !session.user.isAnonymous ? session.user.email : null;

  return (
    <FeedbackForm context={{ screen: "support" }} defaultEmail={email}>
      {children}
    </FeedbackForm>
  );
}

export async function SupportContent() {
  const t = await getExtracted();

  return (
    <Page>
      <SectionPageHeader
        description={t("Ask a question, report a problem or share an idea. We answer by email.")}
        title={t("Help")}
      />

      <Suspense fallback={<FeedbackFormSkeleton />}>
        <ContactSupport>
          <FollowUsOnPage />
        </ContactSupport>
      </Suspense>
    </Page>
  );
}
