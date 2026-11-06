import { AuthFrame } from "@/components/auth-frame";
import {
  Login,
  LoginDescription,
  LoginDivider,
  LoginFooter,
  LoginHeader,
  LoginTitle,
} from "@/components/login";
import { getAuthPageLocale } from "@/i18n/page-locale";
import { PRIVACY_URL, TERMS_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { readRedirectTo } from "../../_utils/auth-redirect";
import { getReturnAppUrl } from "../../_utils/return-app";
import { EmailLoginForm } from "./email-login-form";
import { SocialLogin } from "./social-login";
import { USAGE_DATA_SCRIPT } from "./usage-data-script";

function TermsLink(children: ReactNode) {
  return <a href={TERMS_URL}>{children}</a>;
}

function PrivacyLink(children: ReactNode) {
  return <a href={PRIVACY_URL}>{children}</a>;
}

/**
 * Prerendered for each language, and again with the expired notice for `?error=expired` (a rewrite), so
 * the CDN serves the whole form at once; only the way back streams in after it.
 */
export async function LoginScreen({
  expired,
  searchParams,
}: {
  expired: boolean;
  searchParams: Promise<{ redirectTo?: string | string[] }>;
}) {
  const [t, locale] = await Promise.all([getExtracted(), getAuthPageLocale()]);
  const appUrl = searchParams.then((params) => getReturnAppUrl(readRedirectTo(params.redirectTo)));

  return (
    <AuthFrame appUrl={appUrl}>
      <script
        // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the learner can sign in.
        dangerouslySetInnerHTML={{ __html: USAGE_DATA_SCRIPT }}
      />

      <Login>
        <LoginHeader>
          <LoginTitle>{t("Sign in or create an account")}</LoginTitle>

          {expired && (
            <LoginDescription role="status">
              {t("That sign-in expired. Try again.")}
            </LoginDescription>
          )}
        </LoginHeader>

        <SocialLogin />

        <LoginDivider>{t("Or")}</LoginDivider>

        <EmailLoginForm locale={locale} />

        <LoginFooter>
          {t.rich(
            "By clicking on Continue, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>.",
            { privacy: PrivacyLink, terms: TermsLink },
          )}
        </LoginFooter>
      </Login>
    </AuthFrame>
  );
}
