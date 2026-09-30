import { Setup, SetupDescription, SetupHeader, SetupTitle } from "@/components/setup";
import { listGuardedLearners } from "@zoonk/core/minors/guardian/list-guarded-learners";
import { getSession } from "@zoonk/core/users/session";
import { buttonVariants } from "@zoonk/ui/components/button";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { API_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { GuardedLearnerCard } from "./guarded-learner-card";
import { GuardianAcceptForm } from "./guardian-accept";

type GuardianParams = Awaited<PageProps<"/auth/guardian">["searchParams"]>;

function readParam(value: GuardianParams[string]): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * The invite email links here with `token`. Signing in adds a one-time `token` of its own, so the
 * sign-in link carries the invite as `invite` and the page reads that one first.
 */
function getInviteToken(params: GuardianParams): string | null {
  const invite = readParam(params.invite);

  if (invite || readParam(params.signedIn)) {
    return invite;
  }

  return readParam(params.token);
}

function getSignInHref(inviteToken: string | null) {
  const back = new URL("/auth/guardian", API_URL);
  back.searchParams.set(inviteToken ? "invite" : "signedIn", inviteToken ?? "1");

  return `/auth/login?redirectTo=${encodeURIComponent(back.toString())}`;
}

async function SignInPrompt({ inviteToken }: { inviteToken: string | null }) {
  const t = await getExtracted();

  return (
    <>
      <SetupHeader>
        <SetupTitle>{t("Guardian")}</SetupTitle>
        <SetupDescription>
          {inviteToken
            ? t("Sign in with the email this invite was sent to. It's free.")
            : t("Sign in to see the learners who invited you.")}
        </SetupDescription>
      </SetupHeader>

      {/* oxlint-disable-next-line next/no-html-link-for-pages -- The login page is another route on this host's auth flow, not a Next page link target. */}
      <a className={buttonVariants({ className: "w-full" })} href={getSignInHref(inviteToken)}>
        {t("Sign in to continue")}
      </a>
    </>
  );
}

async function AcceptInvite({ token }: { token: string }) {
  const t = await getExtracted();

  return (
    <>
      <SetupHeader>
        <SetupTitle>{t("Accept the invite")}</SetupTitle>
        <SetupDescription>
          {t(
            "As their guardian, you'll see their weekly activity, can set a daily time limit and approve Plus. You won't see their answers or messages.",
          )}
        </SetupDescription>
      </SetupHeader>

      <GuardianAcceptForm token={token} />
    </>
  );
}

async function GuardedLearners({ accepted }: { accepted: boolean }) {
  const t = await getExtracted();
  const learners = (await listGuardedLearners()) ?? [];

  return (
    <>
      <SetupHeader>
        <SetupTitle>{t("Your learners")}</SetupTitle>
        <SetupDescription>
          {accepted
            ? t("Invite accepted. Here's their week and the controls you can set.")
            : t("Their last seven days and the controls you can set.")}
        </SetupDescription>
      </SetupHeader>

      {learners.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("No learner has invited you yet. Invites arrive by email.")}
        </p>
      ) : (
        learners.map((learner) => <GuardedLearnerCard key={learner.linkId} learner={learner} />)
      )}
    </>
  );
}

async function GuardianView({ searchParams }: PageProps<"/auth/guardian">) {
  const [params, session] = await Promise.all([searchParams, getSession()]);
  const inviteToken = getInviteToken(params);

  if (!session || session.user.isAnonymous) {
    return <SignInPrompt inviteToken={inviteToken} />;
  }

  if (inviteToken) {
    return <AcceptInvite token={inviteToken} />;
  }

  return <GuardedLearners accepted={Boolean(readParam(params.accepted))} />;
}

/**
 * Where a guardian accepts a learner's invite and then manages them: the week at a glance, a
 * daily time limit and Plus approval. It lives on the auth host so links work from every client.
 */
export default function GuardianPage(props: PageProps<"/auth/guardian">) {
  return (
    <Setup>
      <Suspense fallback={<FullPageLoading />}>
        <GuardianView {...props} />
      </Suspense>
    </Setup>
  );
}
